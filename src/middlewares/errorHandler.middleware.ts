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
//   ValidationError (falta un campo / valor fuera de rango) -> 400
//   CastError (id mal formado, ej. "abc")                   -> 400
//   ErrorDeNegocio (regla de negocio rota, ej. cantidad<0)  -> err.status (400 por defecto)
//   cualquier otro caso (bug real, no lo lanzamos nosotros) -> 500 + log


import type { ErrorRequestHandler } from 'express';
import { ErrorDeNegocio } from '../errors/errorDeNegocio.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // ValidationError: Mongoose la lanza cuando un campo obligatorio
  // falta o un valor no pasa el validador del esquema (required,
  // enum, min...).
  if (err instanceof Error && err.name === 'ValidationError') {
    return res.status(400).json({ mensaje: err.message });
  }

  // CastError: el id no tiene forma de ObjectId.
  if (err instanceof Error && err.name === 'CastError') {
    return res.status(400).json({ mensaje: 'Id inválido' });
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
