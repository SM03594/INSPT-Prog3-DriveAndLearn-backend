// ============================================================
//  alumno.controller.ts — Controller HTTP de Alumnos
// ============================================================
// Sin try/catch: en Express 5, si un handler async lanza o su
// promesa rechaza, el error se reenvía solo al middleware de
// errores centralizado (src/middlewares/errorHandler.middleware.ts),
// montado al final de app.ts.

import type { Request, Response } from 'express';
import * as alumnoService from '../services/alumno.service.js';
import {
  aActualizarAlumnoDto,
  aCantidadClasesDto,
  aCrearAlumnoDto,
} from '../dtos/alumno.dto.js';

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
  // El DTO valida la forma del body; el service fija el saldo inicial,
  // que no controla el cliente.
  const alumno = await alumnoService.crear(aCrearAlumnoDto(req.body));
  res.status(201).json(alumno);
}

// aActualizarAlumnoDto: 400 si el body trae campos que no se pueden
// modificar o de un tipo incorrecto.
export async function actualizar(req: Request<{ id: string }>, res: Response) {
  const alumno = await alumnoService.actualizar(
    req.params.id,
    aActualizarAlumnoDto(req.body),
  );
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

// aCantidadClasesDto: 400 si "cantidad" falta, no es un número o
// llega con otros campos. Que sea un entero mayor que 0 lo decide el
// service.
export async function sumarClases(req: Request<{ id: string }>, res: Response) {
  const alumno = await alumnoService.sumarClasesPorReservar(
    req.params.id,
    aCantidadClasesDto(req.body).cantidad,
  );

  if (alumno === null) {
    return res.status(404).json({ mensaje: 'Alumno no encontrado' });
  }

  res.json(alumno);
}

export async function restarClases(req: Request<{ id: string }>, res: Response) {
  const alumno = await alumnoService.restarClasesPorReservar(
    req.params.id,
    aCantidadClasesDto(req.body).cantidad,
  );

  if (alumno === null) {
    return res.status(404).json({ mensaje: 'Alumno no encontrado' });
  }

  res.json(alumno);
}
