// ============================================================
//  profesor.controller.ts — Controller HTTP de Profesores
// ============================================================
// Sin try/catch: en Express 5, si un handler async lanza o su
// promesa rechaza, el error se reenvía solo al middleware de
// errores centralizado (src/middlewares/errorHandler.middleware.ts),
// montado al final de app.ts.

import type { Request, Response } from 'express';
import * as profesorService from '../services/profesor.service.js';

export async function listar(_req: Request, res: Response) {
  const profesores = await profesorService.listar();
  res.json(profesores);
}

export async function obtener(req: Request<{ id: string }>, res: Response) {
  const profesor = await profesorService.obtenerPorId(req.params.id);
  if (profesor === null) {
    return res.status(404).json({ mensaje: 'Profesor no encontrado' });
  }

  res.json(profesor);
}

export async function cambiarNomApe(
  req: Request<{ id: string }>,
  res: Response,
) {
  const profesor = await profesorService.cambiarNomApe(
    req.params.id,
    req.body.nomApe,
  );

  if (profesor === null) {
    return res.status(404).json({ mensaje: 'Profesor no encontrado' });
  }

  res.json(profesor);
}

export async function cambiarFotoPerfil(
  req: Request<{ id: string }>,
  res: Response,
) {
  const foto =
    typeof req.body.foto === 'string'
      ? Buffer.from(req.body.foto, 'base64')
      : Buffer.from(req.body.foto ?? []);

  const profesor = await profesorService.cambiarFotoPerfil(req.params.id, foto);

  if (profesor === null) {
    return res.status(404).json({ mensaje: 'Profesor no encontrado' });
  }

  res.json(profesor);
}

export async function agregarDisponibilidad(
  req: Request<{ id: string }>,
  res: Response,
) {
  const profesor = await profesorService.agregarDisponibilidad(
    req.params.id,
    req.body.dia,
    req.body.tramo,
  );

  if (profesor === null) {
    return res.status(404).json({ mensaje: 'Profesor no encontrado' });
  }

  res.json(profesor);
}

export async function quitarDisponibilidad(
  req: Request<{ id: string }>,
  res: Response,
) {
  const profesor = await profesorService.quitarDisponibilidad(
    req.params.id,
    req.body.dia,
    req.body.tramoId,
  );

  if (profesor === null) {
    return res.status(404).json({ mensaje: 'Profesor no encontrado' });
  }

  res.json(profesor);
}
