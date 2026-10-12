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
  const body: unknown = req.body;
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return res.status(400).json({
      mensaje: 'El cuerpo de la petición debe ser un objeto JSON',
    });
  }

  const camposPermitidos = ['email', 'password', 'nomApe'];
  const camposNoPermitidos = Object.keys(body).filter(
    (campo) => !camposPermitidos.includes(campo),
  );
  if (camposNoPermitidos.length > 0) {
    return res.status(400).json({
      mensaje: `No se pueden enviar estos campos al registrarse: ${camposNoPermitidos.join(', ')}`,
    });
  }

  const datos = body as Record<string, unknown>;
  if (
    typeof datos.email !== 'string' ||
    typeof datos.password !== 'string' ||
    typeof datos.nomApe !== 'string'
  ) {
    return res.status(400).json({
      mensaje: 'Email, contraseña y nombre y apellido son obligatorios',
    });
  }

  const alumno = await alumnoService.crear({
    email: datos.email,
    password: datos.password,
    nomApe: datos.nomApe,
    clasesPorReservar: 0,
  });
  res.status(201).json(alumno);
}

export async function actualizar(req: Request<{ id: string }>, res: Response) {
  const alumno = await alumnoService.actualizar(req.params.id, req.body);
  if (alumno === null) {
    return res.status(404).json({ mensaje: 'Alumno no encontrado' });
  }

  res.json(alumno);
}

export async function eliminar(req: Request<{ id: string }>, res: Response) {
  const alumno = await alumnoService.eliminar(req.params.id);
  if (alumno === null) {
    return res.status(404).json({ mensaje: 'Alumno no encontrado' });
  }

  res.status(204).end();
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
