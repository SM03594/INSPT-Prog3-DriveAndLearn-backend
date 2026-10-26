// ============================================================
//  clase.controller.ts — Controller HTTP de Clases
// ============================================================
// Sin try/catch: en Express 5, si un handler async lanza o su
// promesa rechaza, el error se reenvía solo al middleware de
// errores centralizado (src/middlewares/errorHandler.middleware.ts),
// montado al final de app.ts.

import type { Request, Response } from 'express';
import * as claseService from '../services/clase.service.js';
import type { ActorClase } from '../services/clase.service.js';
import { aActualizarClaseDto, aCrearClaseDto } from '../dtos/clase.dto.js';

// La ruta garantiza la autenticación; acá se adapta req.auth al contrato del service.
function actorDe(req: Request): ActorClase {
  const auth = req.auth!;
  return {
    id: auth.id,
    rol: auth.role,
  };
}

// Los handlers traducen los resultados del service a respuestas HTTP.
export async function listar(req: Request, res: Response) {
  const clases = await claseService.listar(actorDe(req));
  res.json(clases);
}

export async function obtener(req: Request<{ id: string }>, res: Response) {
  const clase = await claseService.obtenerPorId(req.params.id, actorDe(req));
  if (clase === null) {
    res.status(404).json({ mensaje: 'Clase no encontrada' });
  } else {
    res.json(clase);
  }
}

export async function crear(req: Request, res: Response) {
  // El DTO valida la forma (qué campos puede mandar cada rol); el
  // service, las reglas de la reserva.
  const actor = actorDe(req);
  const clase = await claseService.crear(aCrearClaseDto(req.body, actor.rol), actor);
  res.status(201).json(clase);
}

export async function actualizar(req: Request<{ id: string }>, res: Response) {
  const clase = await claseService.actualizar(
    req.params.id,
    aActualizarClaseDto(req.body),
    actorDe(req),
  );
  if (clase === null) {
    res.status(404).json({ mensaje: 'Clase no encontrada' });
  } else {
    res.json(clase);
  }
}

// La ruta ya comprobó que sea el alumno de la clase o un admin. Si la
// clase todavía no empezó, el service le devuelve el crédito al alumno.
export async function eliminar(req: Request<{ id: string }>, res: Response) {
  const clase = await claseService.eliminar(req.params.id, actorDe(req));
  if (clase === null) {
    res.status(404).json({ mensaje: 'Clase no encontrada' });
  } else {
    res.status(204).end();
  }
}
