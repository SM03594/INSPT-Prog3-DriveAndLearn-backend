// ============================================================
//  horario.controller.ts — Controller HTTP de horarios
// ============================================================
// Este controller no apunta a una colección propia: trabaja con
// un CalendarioSemanal, reutilizando las reglas de negocio de
// src/services/calendarioSemanal.service.ts.
//
// La idea es que el handler reciba desde HTTP el calendario y los
// datos necesarios para agregar/quitar un tramo, y luego devolver
// el calendario actualizado.

import type { Request, Response } from 'express';
import {
  agregarTramo,
  quitarTramo,
  validarDia,
} from '../services/reglasEscuela.service.js';

export async function validar(req: Request<{ dia: string }>, res: Response) {
  validarDia(req.params.dia);
  res.json({ valido: true, dia: req.params.dia });
}

export async function agregar(req: Request, res: Response) {
  const { calendario, dia, tramo } = req.body;

  agregarTramo(calendario, dia, tramo);

  res.json(calendario);
}

export async function quitar(req: Request, res: Response) {
  const { calendario, dia, tramoId } = req.body;

  const quitado = quitarTramo(calendario, dia, tramoId);

  if (!quitado) {
    return res.status(404).json({
      mensaje: 'No se encontró el tramo solicitado en ese día',
    });
  }

  res.json(calendario);
}
