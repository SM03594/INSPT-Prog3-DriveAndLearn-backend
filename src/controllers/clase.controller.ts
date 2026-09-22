// ============================================================
//  clase.controller.ts — Controller HTTP de Clases
// ============================================================
// Sin try/catch: en Express 5, si un handler async lanza o su
// promesa rechaza, el error se reenvía solo al middleware de
// errores centralizado (src/middlewares/errorHandler.middleware.ts),
// montado al final de app.ts.

import type { Request, Response } from 'express';
import * as claseService from '../services/clase.service.js';

export async function listar(_req: Request, res: Response) {
  const clases = await claseService.listar();
  res.json(clases);
}

export async function obtener(req: Request<{ id: string }>, res: Response) {
  const clase = await claseService.obtenerPorId(req.params.id);
  if (clase === null) {
    return res.status(404).json({ mensaje: 'Clase no encontrada' });
  }

  res.json(clase);
}

export async function crear(req: Request, res: Response) {
  const clase = await claseService.crear(req.body);
  res.status(201).json(clase);
}

export async function actualizar(req: Request<{ id: string }>, res: Response) {
  const clase = await claseService.actualizar(req.params.id, req.body);
  if (clase === null) {
    return res.status(404).json({ mensaje: 'Clase no encontrada' });
  }

  res.json(clase);
}

export async function cancelar(req: Request<{ id: string }>, res: Response) {
  const clase = await claseService.cancelar(req.params.id);
  if (clase === null) {
    return res.status(404).json({ mensaje: 'Clase no encontrada' });
  }

  res.json(clase);
}
