// ============================================================
//  horario.controller.ts — Controller HTTP de horarios
// ============================================================
// Expone el calendario semanal persistido de la escuela. Las
// modificaciones se guardan en horarioEscuela.service.ts.

import type { Request, Response } from 'express';
import * as horarioService from '../services/horarioEscuela.service.js';
import { validarDia } from '../services/calendarioSemanal.service.js';

export async function validar(req: Request<{ dia: string }>, res: Response) {
  validarDia(req.params.dia);
  res.json({ valido: true, dia: req.params.dia });
}

export async function obtener(_req: Request, res: Response) {
  res.json(await horarioService.obtener());
}

export async function reemplazar(req: Request, res: Response) {
  res.json(await horarioService.reemplazar(req.body));
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
