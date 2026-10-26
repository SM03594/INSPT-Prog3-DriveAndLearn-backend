// ============================================================
//  auto.controller.ts — Controller HTTP de Autos
// ============================================================
// Sin try/catch: en Express 5, si un handler async lanza o su
// promesa rechaza, el error se reenvía solo al middleware de
// errores centralizado (src/middlewares/errorHandler.middleware.ts),
// montado al final de app.ts.

import type { Request, Response } from 'express';
import * as autoService from '../services/auto.service.js';
import {
  aActualizarAutoDto,
  aCambiarActivoDto,
  aCrearAutoDto,
  type ActualizarAutoDto,
  type CambiarActivoDto,
  type CrearAutoDto,
} from '../dtos/auto.dto.js';
import type { AutoDoc } from '../models/Auto.js';

export async function listar(_req: Request, res: Response) {
  const autos: AutoDoc[] = await autoService.listar();
  res.json(autos);
}

export async function obtener(req: Request<{ id: string }>, res: Response) {
  const idAuto: string = req.params.id;
  const auto: AutoDoc | null = await autoService.obtenerPorId(idAuto);

  if (auto === null) {
    res.status(404).json({ mensaje: 'Auto no encontrado' });
  } else {
    res.json(auto);
  }
}

export async function crear(req: Request, res: Response) {
  const datosAuto: CrearAutoDto = aCrearAutoDto(req.body);
  const auto: AutoDoc = await autoService.crear(datosAuto);

  res.status(201).json(auto);
}

export async function actualizar(req: Request<{ id: string }>, res: Response) {
  const idAuto: string = req.params.id;
  const cambios: ActualizarAutoDto = aActualizarAutoDto(req.body);
  const auto: AutoDoc | null = await autoService.actualizar(idAuto, cambios);

  if (auto === null) {
    res.status(404).json({ mensaje: 'Auto no encontrado' });
  } else {
    res.json(auto);
  }
}

export async function cambiarActivo(req: Request<{ id: string }>, res: Response) {
  const idAuto: string = req.params.id;
  const { activo }: CambiarActivoDto = aCambiarActivoDto(req.body);
  const auto: AutoDoc | null = await autoService.cambiarEstado(idAuto, activo);

  if (auto === null) {
    res.status(404).json({ mensaje: 'Auto no encontrado' });
  } else {
    res.json(auto);
  }
}
