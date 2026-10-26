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
  type AgregarTramoDto,
  type QuitarTramoDto,
  type ReemplazarCalendarioDto,
} from '../dtos/calendarioSemanal.dto.js';
import type { CalendarioSemanal } from '../models/CalendarioSemanal.js';

export async function validar(req: Request<{ dia: string }>, res: Response) {
  const dia: string = req.params.dia;

  validarDia(dia);
  res.json({ valido: true, dia });
}

export async function obtener(_req: Request, res: Response) {
  const calendario: CalendarioSemanal = await horarioService.obtener();
  res.json(calendario);
}

export async function reemplazar(req: Request, res: Response) {
  const calendarioNuevo: ReemplazarCalendarioDto = aReemplazarCalendarioDto(req.body);
  const calendario: CalendarioSemanal = await horarioService.reemplazar(calendarioNuevo);

  res.json(calendario);
}

export async function agregar(req: Request, res: Response) {
  const { dia, tramo }: AgregarTramoDto = aAgregarTramoDto(req.body);
  const calendario: CalendarioSemanal = await horarioService.agregarTramo(dia, tramo);

  res.json(calendario);
}

export async function quitar(req: Request, res: Response) {
  const { dia, tramoId }: QuitarTramoDto = aQuitarTramoDto(req.body);
  const calendario: CalendarioSemanal | null = await horarioService.quitarTramo(dia, tramoId);

  if (calendario === null) {
    res.status(404).json({
      mensaje: 'No se encontró el tramo solicitado en ese día',
    });
  } else {
    res.json(calendario);
  }
}
