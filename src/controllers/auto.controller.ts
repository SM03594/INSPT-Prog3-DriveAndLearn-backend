// ============================================================
//  auto.controller.ts — Controller HTTP de Autos
// ============================================================
// (todavía sin middleware de errores propio).

import type { Request, Response } from 'express';
import * as autoService from '../services/auto.service.js';

export async function listar(_req: Request, res: Response) {
  const autos = await autoService.listar();
  res.json(autos);
}

export async function obtener(req: Request<{ id: string }>, res: Response) {
  const auto = await autoService.obtenerPorId(req.params.id);
  if (auto === null) {
    return res.status(404).json({ mensaje: 'Auto no encontrado' });
  }
  res.json(auto);
}

export async function crear(req: Request, res: Response) {
  const auto = await autoService.crear(req.body);
  res.status(201).json(auto);
}

export async function actualizar(req: Request<{ id: string }>, res: Response) {
  const auto = await autoService.actualizar(req.params.id, req.body);
  if (auto === null) {
    return res.status(404).json({ mensaje: 'Auto no encontrado' });
  }
  res.json(auto);
}

export async function cambiarActivo(req: Request<{ id: string }>, res: Response) {
  const auto = await autoService.cambiarEstado(req.params.id, req.body.activo);
  if (auto === null) {
    return res.status(404).json({ mensaje: 'Auto no encontrado' });
  }
  res.json(auto);
}
