// ============================================================
//  calendarioSemanal.controller.ts — Controller HTTP de CalendarioSemanal
// ============================================================
// Este controller reutiliza las reglas de negocio de
// src/services/calendarioSemanal.service.ts para manipular un
// CalendarioSemanal recibido desde HTTP.

import type { Request, Response } from 'express';
import {
  agregarTramo,
  quitarTramo,
  validarDia,
} from '../services/calendarioSemanal.service.js';

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
