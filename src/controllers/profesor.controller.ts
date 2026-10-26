// ============================================================
//  profesor.controller.ts — Controller HTTP de Profesores
// ============================================================
// Sin try/catch: en Express 5, si un handler async lanza o su
// promesa rechaza, el error se reenvía solo al middleware de
// errores centralizado (src/middlewares/errorHandler.middleware.ts),
// montado al final de app.ts.

import type { Request, Response } from 'express';
import * as profesorService from '../services/profesor.service.js';
import * as turnoService from '../services/turno.service.js';
import type { TurnosLibres } from '../services/turno.service.js';
import {
  aCambiarNomApeDto,
  aCrearProfesorDto,
  type CambiarNomApeDto,
  type CrearProfesorDto,
} from '../dtos/profesor.dto.js';
import {
  aAgregarTramoDto,
  aQuitarTramoDto,
  type AgregarTramoDto,
  type QuitarTramoDto,
} from '../dtos/calendarioSemanal.dto.js';
import { aConsultarTurnosDto, type ConsultarTurnosDto } from '../dtos/turno.dto.js';
import { extraerActor } from '../utils/extraerActor.js';
import type { ProfesorDoc } from '../models/Profesor.js';
import type { Actor } from '../types/actor.js';

export async function listar(_req: Request, res: Response) {
  const profesores: ProfesorDoc[] = await profesorService.listar();
  res.json(profesores);
}

export async function crear(req: Request, res: Response) {
  const datosProfesor: CrearProfesorDto = aCrearProfesorDto(req.body);
  const profesor: ProfesorDoc = await profesorService.crear(datosProfesor);

  res.status(201).json(profesor);
}

export async function obtener(req: Request<{ id: string }>, res: Response) {
  const idProfesor: string = req.params.id;
  const profesor: ProfesorDoc | null = await profesorService.obtenerPorId(idProfesor);

  if (profesor === null) {
    res.status(404).json({ mensaje: 'Profesor no encontrado' });
  } else {
    res.json(profesor);
  }
}

export async function cambiarNomApe(
  req: Request<{ id: string }>,
  res: Response,
) {
  const idProfesor: string = req.params.id;
  const { nomApe }: CambiarNomApeDto = aCambiarNomApeDto(req.body);
  const profesor: ProfesorDoc | null = await profesorService.cambiarNomApe(idProfesor, nomApe);

  if (profesor === null) {
    res.status(404).json({ mensaje: 'Profesor no encontrado' });
  } else {
    res.json(profesor);
  }
}

export async function agregarDisponibilidad(
  req: Request<{ id: string }>,
  res: Response,
) {
  const idProfesor: string = req.params.id;
  const { dia, tramo }: AgregarTramoDto = aAgregarTramoDto(req.body);
  const profesor: ProfesorDoc | null =
    await profesorService.agregarDisponibilidad(idProfesor, dia, tramo);

  if (profesor === null) {
    res.status(404).json({ mensaje: 'Profesor no encontrado' });
  } else {
    res.json(profesor);
  }
}

export async function quitarDisponibilidad(
  req: Request<{ id: string }>,
  res: Response,
) {
  const idProfesor: string = req.params.id;
  const { dia, tramoId }: QuitarTramoDto = aQuitarTramoDto(req.body);
  const profesor: ProfesorDoc | null =
    await profesorService.quitarDisponibilidad(idProfesor, dia, tramoId);

  if (profesor === null) {
    res.status(404).json({ mensaje: 'Profesor no encontrado' });
  } else {
    res.json(profesor);
  }
}

// Consulta (no crea nada): 200 con los turnos del día, cada uno con sus
// autos libres. El DTO valida la forma; el service, las reglas.
export async function turnosLibres(
  req: Request<{ id: string }>,
  res: Response,
) {
  const idProfesor: string = req.params.id;
  const consulta: ConsultarTurnosDto = aConsultarTurnosDto(req.body);
  const actor: Actor = extraerActor(req);
  const turnos: TurnosLibres | null =
    await turnoService.listarTurnosLibres(idProfesor, consulta, actor);

  if (turnos === null) {
    res.status(404).json({ mensaje: 'Profesor no encontrado' });
  } else {
    res.json(turnos);
  }
}
