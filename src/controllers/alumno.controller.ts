// ============================================================
//  alumno.controller.ts — Controller HTTP de Alumnos
// ============================================================
// Sin try/catch: en Express 5, si un handler async lanza o su
// promesa rechaza, el error se reenvía solo al middleware de
// errores centralizado (src/middlewares/errorHandler.middleware.ts),
// montado al final de app.ts.

import type { Request, Response } from 'express';
import * as alumnoService from '../services/alumno.service.js';

export async function listar(_req: Request, res: Response) {
  const alumnos = await alumnoService.listar();
  res.json(alumnos);
}

export async function obtener(req: Request<{ id: string }>, res: Response) {
  const alumno = await alumnoService.obtenerPorId(req.params.id);
  if (alumno === null) {
    return res.status(404).json({ mensaje: 'Alumno no encontrado' });
  }

  res.json(alumno);
}

export async function crear(req: Request, res: Response) {
  const alumno = await alumnoService.crear(req.body);
  res.status(201).json(alumno);
}

export async function actualizar(req: Request<{ id: string }>, res: Response) {
  const alumno = await alumnoService.actualizar(req.params.id, req.body);
  if (alumno === null) {
    return res.status(404).json({ mensaje: 'Alumno no encontrado' });
  }

  res.json(alumno);
}

export async function sumarClases(req: Request<{ id: string }>, res: Response) {
  const alumno = await alumnoService.sumarClasesPorReservar(
    req.params.id,
    Number(req.body.cantidad),
  );

  if (alumno === null) {
    return res.status(404).json({ mensaje: 'Alumno no encontrado' });
  }

  res.json(alumno);
}

export async function restarClases(req: Request<{ id: string }>, res: Response) {
  const alumno = await alumnoService.restarClasesPorReservar(
    req.params.id,
    Number(req.body.cantidad),
  );

  if (alumno === null) {
    return res.status(404).json({ mensaje: 'Alumno no encontrado' });
  }

  res.json(alumno);
}
