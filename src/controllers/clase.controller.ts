// ============================================================
//  clase.controller.ts — Controller HTTP de Clases
// ============================================================
// Sin try/catch: en Express 5, si un handler async lanza o su
// promesa rechaza, el error se reenvía solo al middleware de
// errores centralizado (src/middlewares/errorHandler.middleware.ts),
// montado al final de app.ts.

import type { Request, Response } from 'express';
import * as claseService from '../services/clase.service.js';
import {
  aActualizarClaseDto,
  aCrearClaseDto,
  type ActualizarClaseDto,
  type CrearClaseDto,
} from '../dtos/clase.dto.js';
import { extraerActor } from '../utils/extraerActor.js';
import type { ClaseDoc } from '../models/Clase.js';
import type { Actor } from '../types/actor.js';

// Los handlers traducen los resultados del service a respuestas HTTP.
export async function listar(req: Request, res: Response) {
  const actor: Actor = extraerActor(req);
  const clases: ClaseDoc[] = await claseService.listar(actor);

  res.json(clases);
}

export async function obtener(req: Request<{ id: string }>, res: Response) {
  const idClase: string = req.params.id;
  const actor: Actor = extraerActor(req);
  const clase: ClaseDoc | null = await claseService.obtenerPorId(idClase, actor);

  if (clase === null) {
    res.status(404).json({ mensaje: 'Clase no encontrada' });
  } else {
    res.json(clase);
  }
}

export async function crear(req: Request, res: Response) {
  // El DTO valida la forma (qué campos puede mandar cada rol); el
  // service, las reglas de la reserva.
  const actor: Actor = extraerActor(req);
  const datosReserva: CrearClaseDto = aCrearClaseDto(req.body, actor.rol);
  const clase: ClaseDoc = await claseService.crear(datosReserva, actor);

  res.status(201).json(clase);
}

export async function actualizar(req: Request<{ id: string }>, res: Response) {
  const idClase: string = req.params.id;
  const cambios: ActualizarClaseDto = aActualizarClaseDto(req.body);
  const actor: Actor = extraerActor(req);
  const clase: ClaseDoc | null = await claseService.actualizar(idClase, cambios, actor);

  if (clase === null) {
    res.status(404).json({ mensaje: 'Clase no encontrada' });
  } else {
    res.json(clase);
  }
}

// La ruta ya comprobó que sea el alumno de la clase o un admin. Si la
// clase todavía no empezó, el service le devuelve el crédito al alumno.
export async function eliminar(req: Request<{ id: string }>, res: Response) {
  const idClase: string = req.params.id;
  const actor: Actor = extraerActor(req);
  const clase: ClaseDoc | null = await claseService.eliminar(idClase, actor);

  if (clase === null) {
    res.status(404).json({ mensaje: 'Clase no encontrada' });
  } else {
    res.status(204).end();
  }
}
