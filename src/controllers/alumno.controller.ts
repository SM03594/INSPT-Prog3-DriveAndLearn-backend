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
  type ActualizarAlumnoDto,
  type CantidadClasesDto,
  type CrearAlumnoDto,
} from '../dtos/alumno.dto.js';
import type { AlumnoDoc } from '../models/Alumno.js';

export async function listar(_req: Request, res: Response) {
  const alumnos: AlumnoDoc[] = await alumnoService.listar();
  res.json(alumnos);
}

export async function obtener(req: Request<{ id: string }>, res: Response) {
  const idAlumno: string = req.params.id;
  const alumno: AlumnoDoc | null = await alumnoService.obtenerPorId(idAlumno);

  if (alumno === null) {
    res.status(404).json({ mensaje: 'Alumno no encontrado' });
  } else {
    res.json(alumno);
  }
}

export async function crear(req: Request, res: Response) {
  // El DTO valida la forma del body; el service fija el saldo inicial,
  // que no controla el cliente.
  const datosAlumno: CrearAlumnoDto = aCrearAlumnoDto(req.body);
  const alumno: AlumnoDoc = await alumnoService.crear(datosAlumno);

  res.status(201).json(alumno);
}

// aActualizarAlumnoDto: 400 si el body trae campos que no se pueden
// modificar o de un tipo incorrecto.
export async function actualizar(req: Request<{ id: string }>, res: Response) {
  const idAlumno: string = req.params.id;
  const cambios: ActualizarAlumnoDto = aActualizarAlumnoDto(req.body);
  const alumno: AlumnoDoc | null = await alumnoService.actualizar(idAlumno, cambios);

  if (alumno === null) {
    res.status(404).json({ mensaje: 'Alumno no encontrado' });
  } else {
    res.json(alumno);
  }
}

export async function eliminar(req: Request<{ id: string }>, res: Response) {
  const idAlumno: string = req.params.id;
  const alumno: AlumnoDoc | null = await alumnoService.eliminar(idAlumno);

  if (alumno === null) {
    res.status(404).json({ mensaje: 'Alumno no encontrado' });
  } else {
    res.status(204).end();
  }
}

// aCantidadClasesDto: 400 si "cantidad" falta, no es un número o
// llega con otros campos. Que sea un entero mayor que 0 lo decide el
// service.
export async function sumarClases(req: Request<{ id: string }>, res: Response) {
  const idAlumno: string = req.params.id;
  const { cantidad }: CantidadClasesDto = aCantidadClasesDto(req.body);
  const alumno: AlumnoDoc | null = await alumnoService.sumarClasesPorReservar(idAlumno, cantidad);

  if (alumno === null) {
    res.status(404).json({ mensaje: 'Alumno no encontrado' });
  } else {
    res.json(alumno);
  }
}

export async function restarClases(req: Request<{ id: string }>, res: Response) {
  const idAlumno: string = req.params.id;
  const { cantidad }: CantidadClasesDto = aCantidadClasesDto(req.body);
  const alumno: AlumnoDoc | null = await alumnoService.restarClasesPorReservar(idAlumno, cantidad);

  if (alumno === null) {
    res.status(404).json({ mensaje: 'Alumno no encontrado' });
  } else {
    res.json(alumno);
  }
}
