// ============================================================
//  profesor.service.ts — Capa de servicio de Profesores
// ============================================================

import {
  ProfesorModel,
  type ProfesorDoc,
} from '../models/Profesor.js';
import type { Tramo } from '../models/CalendarioSemanal.js';
import { ErrorDeNegocio } from '../errors/errorDeNegocio.js';
import { agregarTramo, quitarTramo, validarDia } from './calendarioSemanal.service.js';
import type { CrearProfesorDto } from '../dtos/profesor.dto.js';

// La forma de lo que manda el cliente la valida el DTO en el
// controller (ver dtos/profesor.dto.ts): acá llegan valores con el
// tipo correcto, y se aplican las reglas.

// Regla: el nombre no puede quedar vacío ("   " tampoco sirve).
function nombreObligatorio(nomApe: string): string {
  if (nomApe.trim() === '') {
    throw new ErrorDeNegocio('El nombre y apellido del profesor es obligatorio');
  }
  return nomApe;
}

function esBufferSerializado(
  valor: unknown,
): valor is { type: 'Buffer'; data: number[] } {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    return false;
  }
  const objeto = valor as Record<string, unknown>;
  return objeto.type === 'Buffer' && Array.isArray(objeto.data) &&
    objeto.data.every((byte) =>
      typeof byte === 'number' && Number.isInteger(byte) && byte >= 0 && byte <= 255,
    );
}

function fotoComoBuffer(valor: unknown): Buffer {
  if (valor === undefined || valor === null) return Buffer.alloc(0);
  if (Buffer.isBuffer(valor)) return valor;
  if (typeof valor === 'string') return Buffer.from(valor, 'base64');
  if (
    Array.isArray(valor) &&
    valor.every((byte) =>
      typeof byte === 'number' && Number.isInteger(byte) && byte >= 0 && byte <= 255,
    )
  ) {
    return Buffer.from(valor);
  }
  if (esBufferSerializado(valor)) return Buffer.from(valor.data);
  throw new ErrorDeNegocio('La foto debe enviarse en base64 o como bytes');
}

// ============================================================
//  listar — todos los profesores
// ============================================================
export async function listar(): Promise<ProfesorDoc[]> {
  return ProfesorModel.find();
}

export async function crear(datos: CrearProfesorDto): Promise<ProfesorDoc> {
  return ProfesorModel.create({ nomApe: nombreObligatorio(datos.nomApe) });
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
    { nomApe: nombreObligatorio(nomApe) },
    { new: true, runValidators: true },
  );
}

// ============================================================
//  cambiarFotoPerfil — reemplaza la foto de perfil
// ============================================================
export async function cambiarFotoPerfil(
  id: string,
  fotoEntrada: unknown,
): Promise<ProfesorDoc | null> {
  const profesor = await ProfesorModel.findById(id);
  if (profesor === null) return null;

  profesor.fotoPerfil = fotoComoBuffer(fotoEntrada);
  return profesor.save();
}

// ============================================================
//  agregarDisponibilidad — suma un tramo al día indicado
// ============================================================
export async function agregarDisponibilidad(
  id: string,
  dia: string,
  tramo: Tramo,
): Promise<ProfesorDoc | null> {
  const profesor = await ProfesorModel.findById(id);
  if (profesor === null) return null;

  validarDia(dia);
  agregarTramo(profesor.disponibilidad, dia, tramo);
  return profesor.save();
}

// ============================================================
//  quitarDisponibilidad — elimina el tramo con ese _id
// ============================================================
export async function quitarDisponibilidad(
  id: string,
  dia: string,
  tramoId: string,
): Promise<ProfesorDoc | null> {
  const profesor = await ProfesorModel.findById(id);
  if (profesor === null) return null;

  validarDia(dia);
  const quitado = quitarTramo(profesor.disponibilidad, dia, tramoId);
  if (!quitado) return null;

  return profesor.save();
}
