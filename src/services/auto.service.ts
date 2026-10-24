// ============================================================
//  auto.service.ts — Capa de servicio de Autos
// ============================================================

import {
  AutoModel,
  type AutoDoc,
} from '../models/Auto.js';
import { verSiErrorClaveDuplicada } from '../errors/errorClaveDuplicada.js';
import type { ActualizarAutoDto, CrearAutoDto } from '../dtos/auto.dto.js';

// Mensaje de respaldo si el Schema no definió uno propio para la
// patente repetida (ver verSiErrorClaveDuplicada).
const MENSAJE_PATENTE_DUPLICADA = 'La patente ya está en uso';


export async function listar(): Promise<AutoDoc[]> {
  return AutoModel.find();
}


export async function obtenerPorId(id: string): Promise<AutoDoc | null> {
  return AutoModel.findById(id);
}


// "datos" ya es un CrearAutoDto: la forma la validó el controller (ver
// dtos/auto.dto.ts). create() puede chocar contra el índice unique de
// patente: se atrapa el error crudo de Mongo/Mongoose acá, no en el
// middleware, porque acá es donde se sabe qué campo es y qué mensaje
// tiene sentido para Auto.
export async function crear(datos: CrearAutoDto): Promise<AutoDoc> {
  try {
    return await AutoModel.create(datos);
  } catch (err) {
    throw verSiErrorClaveDuplicada(err, MENSAJE_PATENTE_DUPLICADA);
  }
}

// ============================================================
//  actualizar — modifica un auto existente
// ============================================================
// "cambios" ya es un ActualizarAutoDto: solo los datos del auto que el
// cliente quiere cambiar (sin "activo" ni operadores como $set).
// Devuelve el auto YA actualizado, o null si el id no existe.
export async function actualizar(
  id: string,
  cambios: ActualizarAutoDto,
): Promise<AutoDoc | null> {
  try {
    return await AutoModel.findByIdAndUpdate(id, cambios, {
      new: true, // devolver el documento actualizado, no el previo
      runValidators: true, // correr las validaciones del esquema también en el update
    });
  } catch (err) {
    // findByIdAndUpdate también puede chocar contra el índice unique
    // si "cambios.patente" coincide con la de otro auto.
    throw verSiErrorClaveDuplicada(err, MENSAJE_PATENTE_DUPLICADA);
  }
}

// ============================================================
//  cambiarEstado — pone o saca un auto de servicio
// ============================================================
// "estadoNuevo" ya es un booleano: lo garantiza aCambiarActivoDto.
export async function cambiarEstado(
  id: string,
  estadoNuevo: boolean,
): Promise<AutoDoc | null> {
  return AutoModel.findByIdAndUpdate(
    id,
    { activo: estadoNuevo },
    { new: true, runValidators: true }, //devolcer el documento acutalizado
  );
}
