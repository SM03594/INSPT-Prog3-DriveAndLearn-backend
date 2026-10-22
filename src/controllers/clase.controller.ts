// ============================================================
//  clase.controller.ts — Controller HTTP de Clases
// ============================================================
// Sin try/catch: en Express 5, si un handler async lanza o su
// promesa rechaza, el error se reenvía solo al middleware de
// errores centralizado (src/middlewares/errorHandler.middleware.ts),
// montado al final de app.ts.

import type { Request, Response } from 'express';
import * as claseService from '../services/clase.service.js';
import { ErrorDeNegocio } from '../errors/errorDeNegocio.js';
import { ErrorAutenticacion } from '../errors/errorAutenticacion.js';
import type { ActorClase } from '../services/clase.service.js';

// Adapta el formato de autenticación al contrato del service; no decide permisos.
function actorDe(req: Request): ActorClase {
  if (req.auth === undefined) {
    throw new ErrorAutenticacion('Se requiere autenticación válida');
  }
  return {
    id: req.auth.id,
    rol: req.auth.role,
  };
}

// El controller verifica la estructura HTTP; las reglas sobre campos viven en el service.
function bodyComoObjeto(req: Request): Record<string, unknown> {
  const body: unknown = req.body;
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ErrorDeNegocio('El cuerpo de la petición debe ser un objeto JSON');
  }
  return body as Record<string, unknown>;
}

// Los handlers traducen los resultados del service a respuestas HTTP.
export async function listar(req: Request, res: Response) {
  const clases = await claseService.listar(actorDe(req));
  res.json(clases);
}

export async function obtener(req: Request<{ id: string }>, res: Response) {
  const clase = await claseService.obtenerPorId(req.params.id, actorDe(req));
  if (clase === null) {
    return res.status(404).json({ mensaje: 'Clase no encontrada' });
  }

  res.json(clase);
}

export async function crear(req: Request, res: Response) {
  const actor = actorDe(req);
  const body = bodyComoObjeto(req);
  const clase = await claseService.crear(body, actor);
  res.status(201).json(clase);
}

export async function actualizar(req: Request<{ id: string }>, res: Response) {
  const body = bodyComoObjeto(req);
  const clase = await claseService.actualizar(
    req.params.id,
    body,
    actorDe(req),
  );
  if (clase === null) {
    return res.status(404).json({ mensaje: 'Clase no encontrada' });
  }

  res.json(clase);
}

export async function cancelar(req: Request<{ id: string }>, res: Response) {
  const clase = await claseService.cancelar(req.params.id, actorDe(req));
  if (clase === null) {
    return res.status(404).json({ mensaje: 'Clase no encontrada' });
  }

  res.json(clase);
}
