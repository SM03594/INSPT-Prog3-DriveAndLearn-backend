// ============================================================
//  errorHandler.middleware.ts — Middleware de errores central
// ============================================================
// Un middleware de errores se reconoce por tener EXACTAMENTE 4
// parámetros: (err, req, res, next). Va montado al final de
// app.ts, después de todos los routers (ver
// guia-middleware-handlers-y-routers.md §3 y §6).
//
// En Express 5, si un handler async lanza o su promesa rechaza,
// Express reenvía el error acá automáticamente (hace el next(err)
// por vos). Por eso los controllers no llevan try/catch.
//
// Traduce los errores documentados en guia-capa-service.md §9:
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
import { comoErrorLecturaCuerpo, ErrorLecturaCuerpo } from '../errors/errorLecturaCuerpo.js';

export const errorHandler: ErrorRequestHandler = (errOriginal, _req, res, _next) => {

  const err = comoErrorLecturaCuerpo(errOriginal);

  if (err instanceof mongoose.Error.ValidationError) {
    const mensaje = Object.values(err.errors)
      //para devolver varios mensajes de error a la vez de distintos campos
      .map((e) => e.message)
      .join('. ');
    return res.status(400).json({ mensaje });
  }

  // CastError: el id no tiene forma de ObjectId.
  if (err instanceof Error && err.name === 'CastError') {
    return res.status(400).json({ mensaje: 'Id inválido' });
  }

  // Errores de la capa HTTP (los lanza auth.middleware, o los traduce
  // comoErrorLecturaCuerpo): cada uno trae su status (400, 401, 403,
  // o el 4xx de un ErrorLecturaCuerpo).
  if (
    err instanceof ErrorLecturaCuerpo ||
    err instanceof ErrorPeticionInvalida ||
    err instanceof ErrorAutenticacion ||
    err instanceof ErrorAutorizacion
  ) {
    return res.status(err.status).json({ mensaje: err.message });
  }

  // ErrorDeNegocio (y sus subclases, como ErrorClaveDuplicada): una
  // regla de negocio que el service chequeó/tradujo a mano y decidió
  // cortar (no es un bug). El status lo elige quien la lanzó.
  if (err instanceof ErrorDeNegocio) {
    return res.status(err.status).json({ mensaje: err.message });
  }

  // Cualquier otro caso: un bug real. Se loguea para poder
  // diagnosticarlo y se responde 500 sin exponer detalles internos.
  console.error(err);
  res.status(500).json({ mensaje: 'Error interno del servidor' });
};
