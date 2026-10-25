// ============================================================
//  auto.controller.ts — Controller HTTP de Autos
// ============================================================
// Sin try/catch: en Express 5, si un handler async lanza o su
// promesa rechaza, el error se reenvía solo al middleware de
// errores centralizado (src/middlewares/errorHandler.middleware.ts),
// montado al final de app.ts.

import type { Request, Response } from 'express';
import * as autoService from '../services/auto.service.js';
import { aActualizarAutoDto, aCambiarActivoDto, aCrearAutoDto } from '../dtos/auto.dto.js';

export async function listar(_req: Request, res: Response) {
  const autos = await autoService.listar();
  res.json(autos);
}

export async function obtener(req: Request<{ id: string }>, res: Response) {
  const auto = await autoService.obtenerPorId(req.params.id);
  if (auto === null) {
    res.status(404).json({ mensaje: 'Auto no encontrado' });
  } else {
    res.json(auto);
  }
}

export async function crear(req: Request, res: Response) {
  const auto = await autoService.crear(aCrearAutoDto(req.body));
  res.status(201).json(auto);
}

export async function actualizar(req: Request<{ id: string }>, res: Response) {
  const auto = await autoService.actualizar(req.params.id, aActualizarAutoDto(req.body));
  if (auto === null) {
    res.status(404).json({ mensaje: 'Auto no encontrado' });
  } else {
    res.json(auto);
  }
}

export async function cambiarActivo(req: Request<{ id: string }>, res: Response) {
  const auto = await autoService.cambiarEstado(req.params.id, aCambiarActivoDto(req.body).activo);
  if (auto === null) {
    res.status(404).json({ mensaje: 'Auto no encontrado' });
  } else {
    res.json(auto);
  }
}
