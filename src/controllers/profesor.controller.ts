// ============================================================
//  profesor.controller.ts — Controller HTTP de Profesores
// ============================================================
// Sin try/catch: en Express 5, si un handler async lanza o su
// promesa rechaza, el error se reenvía solo al middleware de
// errores centralizado (src/middlewares/errorHandler.middleware.ts),
// montado al final de app.ts.

import type { Request, Response } from 'express';
import * as profesorService from '../services/profesor.service.js';
import { aCambiarNomApeDto, aCrearProfesorDto } from '../dtos/profesor.dto.js';
import { aAgregarTramoDto, aQuitarTramoDto } from '../dtos/calendarioSemanal.dto.js';

export async function listar(_req: Request, res: Response) {
  const profesores = await profesorService.listar();
  res.json(profesores);
}

export async function crear(req: Request, res: Response) {
  const profesor = await profesorService.crear(aCrearProfesorDto(req.body));
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
  const { nomApe } = aCambiarNomApeDto(req.body);
  const profesor = await profesorService.cambiarNomApe(req.params.id, nomApe);

  if (profesor === null) {
    return res.status(404).json({ mensaje: 'Profesor no encontrado' });
  }

  res.json(profesor);
}

export async function agregarDisponibilidad(
  req: Request<{ id: string }>,
  res: Response,
) {
  const { dia, tramo } = aAgregarTramoDto(req.body);
  const profesor = await profesorService.agregarDisponibilidad(req.params.id, dia, tramo);

  if (profesor === null) {
    return res.status(404).json({ mensaje: 'Profesor no encontrado' });
  }

  res.json(profesor);
}

export async function quitarDisponibilidad(
  req: Request<{ id: string }>,
  res: Response,
) {
  const { dia, tramoId } = aQuitarTramoDto(req.body);
  const profesor = await profesorService.quitarDisponibilidad(req.params.id, dia, tramoId);

  if (profesor === null) {
    return res.status(404).json({ mensaje: 'Profesor no encontrado' });
  }

  res.json(profesor);
}
