// ============================================================
//  profesor.controller.ts — Controller HTTP de Profesores
// ============================================================
// Sin try/catch: en Express 5, si un handler async lanza o su
// promesa rechaza, el error se reenvía solo al middleware de
// errores centralizado (src/middlewares/errorHandler.middleware.ts),
// montado al final de app.ts.

import type { Request, Response } from 'express';
import * as profesorService from '../services/profesor.service.js';
import { cuerpoComoObjeto } from '../utils/cuerpoPeticion.js';

export async function listar(_req: Request, res: Response) {
  const profesores = await profesorService.listar();
  res.json(profesores);
}

export async function crear(req: Request, res: Response) {
  const profesor = await profesorService.crear(cuerpoComoObjeto(req.body));
  res.status(201).json(profesor);
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
  const body = cuerpoComoObjeto(req.body);
  const profesor = await profesorService.cambiarNomApe(
    req.params.id,
    body.nomApe,
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
  const body = cuerpoComoObjeto(req.body);
  const profesor = await profesorService.cambiarFotoPerfil(req.params.id, body.foto);

  if (profesor === null) {
    return res.status(404).json({ mensaje: 'Profesor no encontrado' });
  }

  res.json(profesor);
}

export async function agregarDisponibilidad(
  req: Request<{ id: string }>,
  res: Response,
) {
  const body = cuerpoComoObjeto(req.body);
  const profesor = await profesorService.agregarDisponibilidad(
    req.params.id,
    body.dia,
    body.tramo,
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
  const body = cuerpoComoObjeto(req.body);
  const profesor = await profesorService.quitarDisponibilidad(
    req.params.id,
    body.dia,
    body.tramoId,
  );

  if (profesor === null) {
    return res.status(404).json({ mensaje: 'Profesor no encontrado' });
  }

  res.json(profesor);
}
