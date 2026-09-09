// ============================================================
//  profesor.service.ts — Capa de servicio de Profesores
// ============================================================


import { ProfesorModel, type ProfesorDoc } from '../models/Profesor.js';
import type { Horario } from '../models/Horario.js';

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
// Vía findById + .save() (no findByIdAndUpdate): los "update
// validators" le pasan al validador un BSON Binary sin .length,
// y el chequeo de tamaño máximo (2 MiB) daría siempre inválido.
// Con .save() el valor es un Buffer real y el validador funciona.
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
//  agregarDisponibilidad — suma un intervalo al array
// ============================================================
export async function agregarDisponibilidad(
  id: string,
  horario: Horario,
): Promise<ProfesorDoc | null> {
  const profesor = await ProfesorModel.findById(id);
  if (profesor === null) return null;

  profesor.disponibilidad.push(horario);
  return profesor.save();
}

/*
  Pendiente: validar que no se pisen los horarios
*/

// ============================================================
//  quitarDisponibilidad — elimina el intervalo con ese _id
// ============================================================
export async function quitarDisponibilidad(
  id: string,
  horarioId: string,
): Promise<ProfesorDoc | null> {
  const profesor = await ProfesorModel.findById(id);
  if (profesor === null) return null;

  const indice = profesor.disponibilidad.findIndex(
    (h) => h._id?.toString() === horarioId,
  );
  if (indice === -1) return null;

  profesor.disponibilidad.splice(indice, 1);
  return profesor.save();
}