// ============================================================
//  administrador.controller.ts — Controller HTTP de Administradores
// ============================================================
// Sin try/catch: en Express 5, si un handler async lanza o su
// promesa rechaza, el error se reenvía solo al middleware de
// errores centralizado (src/middlewares/errorHandler.middleware.ts),
// montado al final de app.ts.

import type { Request, Response } from 'express';
import * as administradorService from '../services/administrador.service.js';

export async function listar(_req: Request, res: Response) {
  const administradores = await administradorService.listar();
  res.json(administradores);
}

export async function obtener(req: Request<{ id: string }>, res: Response) {
  const administrador = await administradorService.obtenerPorId(req.params.id);
  if (administrador === null) {
    return res.status(404).json({ mensaje: 'Administrador no encontrado' });
  }

  res.json(administrador);
}

export async function crear(req: Request, res: Response) {
  const administrador = await administradorService.crear(req.body);
  res.status(201).json(administrador);
}

export async function actualizar(req: Request<{ id: string }>, res: Response) {
  const administrador = await administradorService.actualizar(
    req.params.id,
    req.body,
  );

  if (administrador === null) {
    return res.status(404).json({ mensaje: 'Administrador no encontrado' });
  }

  res.json(administrador);
}
