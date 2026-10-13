// ============================================================
//  calendarioSemanal.controller.ts — Controller HTTP de CalendarioSemanal
// ============================================================
// Este controller reutiliza las reglas de negocio de
// src/services/calendarioSemanal.service.ts para manipular un
// CalendarioSemanal recibido desde HTTP.

import type { Request, Response } from 'express';
import {
  validarDia,
} from '../services/calendarioSemanal.service.js';
import * as horarioService from '../services/horarioEscuela.service.js';

export async function validar(req: Request<{ dia: string }>, res: Response) {
  validarDia(req.params.dia);
  res.json({ valido: true, dia: req.params.dia });
}

export async function agregar(req: Request, res: Response) {
  const { dia, tramo } = req.body;
  res.json(await horarioService.agregarTramo(dia, tramo));
}

export async function quitar(req: Request, res: Response) {
  const { dia, tramoId } = req.body;
  const calendario = await horarioService.quitarTramo(dia, tramoId);
  if (calendario === null) {
    return res.status(404).json({
      mensaje: 'No se encontró el tramo solicitado en ese día',
    });
  }
  res.json(calendario);
}
