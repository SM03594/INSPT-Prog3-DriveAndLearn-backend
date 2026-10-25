// ============================================================
//  horarioEscuela.controller.ts — Controller HTTP del horario de la escuela
// ============================================================
// Expone el calendario semanal persistido de la escuela. Las
// modificaciones se guardan en horarioEscuela.service.ts.

import type { Request, Response } from 'express';
import * as horarioService from '../services/horarioEscuela.service.js';
import { validarDia } from '../services/calendarioSemanal.service.js';
import {
  aAgregarTramoDto,
  aQuitarTramoDto,
  aReemplazarCalendarioDto,
} from '../dtos/calendarioSemanal.dto.js';

export async function validar(req: Request<{ dia: string }>, res: Response) {
  validarDia(req.params.dia);
  res.json({ valido: true, dia: req.params.dia });
}

export async function obtener(_req: Request, res: Response) {
  res.json(await horarioService.obtener());
}

export async function reemplazar(req: Request, res: Response) {
  res.json(await horarioService.reemplazar(aReemplazarCalendarioDto(req.body)));
}

export async function agregar(req: Request, res: Response) {
  const { dia, tramo } = aAgregarTramoDto(req.body);
  res.json(await horarioService.agregarTramo(dia, tramo));
}

export async function quitar(req: Request, res: Response) {
  const { dia, tramoId } = aQuitarTramoDto(req.body);
  const calendario = await horarioService.quitarTramo(dia, tramoId);
  if (calendario === null) {
    res.status(404).json({
      mensaje: 'No se encontró el tramo solicitado en ese día',
    });
  } else {
    res.json(calendario);
  }
}
