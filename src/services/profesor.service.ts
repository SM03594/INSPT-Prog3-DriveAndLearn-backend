// ============================================================
//  profesor.service.ts — Capa de servicio de Profesores
// ============================================================

import { ProfesorModel, type ProfesorDoc } from '../models/Profesor.js';
import type { Tramo, Dia } from '../models/CalendarioSemanal.js';
import { agregarTramo, quitarTramo } from './calendarioSemanal.service.js';

// ============================================================
//  listar — todos los profesores
// ============================================================
export async function listar(): Promise<ProfesorDoc[]> {
  return ProfesorModel.find();
}

// ============================================================
//  obtenerPorId — un profesor por su _id (null si no existe)
// ============================================================
// Si el id no tiene forma de ObjectId, Mongoose lanza un
// CastError (el controller lo traduce a 400).
export async function obtenerPorId(id: string): Promise<ProfesorDoc | null> {
  return ProfesorModel.findById(id);
}

// ============================================================
//  cambiarNomApe — actualiza el nombre y apellido
// ============================================================
export async function cambiarNomApe(
  id: string,
  nomApe: string,
): Promise<ProfesorDoc | null> {
  return ProfesorModel.findByIdAndUpdate(
    id,
    { nomApe },
    { new: true, runValidators: true },
  );
}

// ============================================================
//  cambiarFotoPerfil — reemplaza la foto de perfil
// ============================================================
export async function cambiarFotoPerfil(
  id: string,
  foto: Buffer,
): Promise<ProfesorDoc | null> {
  const profesor = await ProfesorModel.findById(id);
  if (profesor === null) return null;

  profesor.fotoPerfil = foto;
  return profesor.save();
}

// ============================================================
//  agregarDisponibilidad — suma un tramo al día indicado
// ============================================================
export async function agregarDisponibilidad(
  id: string,
  dia: Dia,
  tramo: Tramo,
): Promise<ProfesorDoc | null> {
  const profesor = await ProfesorModel.findById(id);
  if (profesor === null) return null;

  agregarTramo(profesor.disponibilidad, dia, tramo);
  return profesor.save();
}

// ============================================================
//  quitarDisponibilidad — elimina el tramo con ese _id
// ============================================================
export async function quitarDisponibilidad(
  id: string,
  dia: Dia,
  tramoId: string,
): Promise<ProfesorDoc | null> {
  const profesor = await ProfesorModel.findById(id);
  if (profesor === null) return null;

  const quitado = quitarTramo(profesor.disponibilidad, dia, tramoId);
  if (!quitado) return null;

  return profesor.save();
}
