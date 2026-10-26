// ============================================================
//  administrador.controller.ts — Controller HTTP de Administradores
// ============================================================
// Sin try/catch: en Express 5, si un handler async lanza o su
// promesa rechaza, el error se reenvía solo al middleware de
// errores centralizado (src/middlewares/errorHandler.middleware.ts),
// montado al final de app.ts.

import type { Request, Response } from 'express';
import * as administradorService from '../services/administrador.service.js';
import {
  aActualizarAdministradorDto,
  aCrearAdministradorDto,
  type ActualizarAdministradorDto,
  type CrearAdministradorDto,
} from '../dtos/administrador.dto.js';
import type { AdministradorDoc } from '../models/Administrador.js';

export async function listar(_req: Request, res: Response) {
  const administradores: AdministradorDoc[] = await administradorService.listar();
  res.json(administradores);
}

export async function obtener(req: Request<{ id: string }>, res: Response) {
  const idAdministrador: string = req.params.id;
  const administrador: AdministradorDoc | null =
    await administradorService.obtenerPorId(idAdministrador);

  if (administrador === null) {
    res.status(404).json({ mensaje: 'Administrador no encontrado' });
  } else {
    res.json(administrador);
  }
}

// El controller arma el DTO a partir del body (400 si no cumple el
// contrato) y el service recibe datos ya validados.
export async function crear(req: Request, res: Response) {
  const datosAdministrador: CrearAdministradorDto = aCrearAdministradorDto(req.body);
  const administrador: AdministradorDoc = await administradorService.crear(datosAdministrador);

  res.status(201).json(administrador);
}

export async function actualizar(req: Request<{ id: string }>, res: Response) {
  const idAdministrador: string = req.params.id;
  const cambios: ActualizarAdministradorDto = aActualizarAdministradorDto(req.body);
  const administrador: AdministradorDoc | null =
    await administradorService.actualizar(idAdministrador, cambios);

  if (administrador === null) {
    res.status(404).json({ mensaje: 'Administrador no encontrado' });
  } else {
    res.json(administrador);
  }
}

export async function eliminar(req: Request<{ id: string }>, res: Response) {
  const idAdministrador: string = req.params.id;
  const administrador: AdministradorDoc | null =
    await administradorService.eliminar(idAdministrador);

  if (administrador === null) {
    res.status(404).json({ mensaje: 'Administrador no encontrado' });
  } else {
    res.status(204).end();
  }
}
