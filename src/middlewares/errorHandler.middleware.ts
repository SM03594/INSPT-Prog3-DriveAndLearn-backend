// ============================================================
//  errorHandler.middleware.ts — Middleware de errores central
// ============================================================
// Un middleware de errores se reconoce por tener EXACTAMENTE 4
// parámetros: (err, req, res, next). Va montado al final de
// app.ts, después de todos los routers, para recibir los errores
// de cualquiera de ellos.
//
// En Express 5, si un handler async lanza o su promesa rechaza,
// Express reenvía el error acá automáticamente (hace el next(err)
// por vos). Por eso los controllers no llevan try/catch.
//
// Traduce cada error a una respuesta { mensaje } con su status:
//   body ilegible (JSON mal formado, demasiado grande...)   -> err.status (400, 413, 415)
//   ValidationError (falta un campo / valor fuera de rango) -> 400
//   CastError (id mal formado, ej. "abc")                   -> 400
//   ErrorPeticionInvalida (pedido mal armado)               -> err.status (400 por defecto)
//   ErrorAutenticacion (no sabemos quién es)                -> 401
//   ErrorAutorizacion (sabemos quién es, pero no puede)     -> 403
//   ErrorDeNegocio (regla de negocio rota, ej. cantidad<0)  -> err.status (400 por defecto)
//   cualquier otro caso (bug real, no lo lanzamos nosotros) -> 500 + log


import type { ErrorRequestHandler } from 'express';
import mongoose from 'mongoose';
import { ErrorAutenticacion } from '../errors/errorAutenticacion.js';
import { ErrorAutorizacion } from '../errors/errorAutorizacion.js';
import { ErrorDeNegocio } from '../errors/errorDeNegocio.js';
import { ErrorPeticionInvalida } from '../errors/errorPeticionInvalida.js';
import { verSiErrorLecturaCuerpo } from '../errors/errorLecturaCuerpo.js';

export const errorHandler: ErrorRequestHandler = (errOriginal, _req, res, _next) => {
  const err = verSiErrorLecturaCuerpo(errOriginal);
  // Cada rama solo decide qué responder; se responde una vez, al final.
  let status: number;
  let mensaje: string;

  if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    mensaje = Object.values(err.errors)
      //para devolver varios mensajes de error a la vez de distintos campos
      .map((e) => e.message)
      .join('. ');
  } else if (err instanceof Error && err.name === 'CastError') {
    // CastError: el id no tiene forma de ObjectId.
    status = 400;
    mensaje = 'Id inválido';
  } else if (
    // Errores de la capa HTTP: los lanzan auth.middleware y
    // validacionDeCuerpo, o los traduce verSiErrorLecturaCuerpo.
    // ErrorPeticionInvalida incluye a sus subclases (ErrorLecturaCuerpo,
    // ErrorJsonInvalido, ErrorPeticionSinCuerpo).
    err instanceof ErrorPeticionInvalida ||
    err instanceof ErrorAutenticacion ||
    err instanceof ErrorAutorizacion ||
    // ErrorDeNegocio (y sus subclases, como ErrorClaveDuplicada): una
    // regla de negocio que el service chequeó/tradujo a mano y decidió
    // cortar (no es un bug).
    err instanceof ErrorDeNegocio
  ) {
    // Todos traen su status: lo elige quien lanzó el error.
    status = err.status;
    mensaje = err.message;
  } else {
    // Cualquier otro caso: un bug real. Se loguea para poder
    // diagnosticarlo y se responde 500 sin exponer detalles internos.
    console.error(err);
    status = 500;
    mensaje = 'Error interno del servidor';
  }

  res.status(status).json({ mensaje });
};
