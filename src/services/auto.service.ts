// ============================================================
//  auto.service.ts — Capa de servicio de Autos
// ============================================================

import {
  AutoModel,
  type AutoDoc,
  type Auto,
} from '../models/Auto.js';
import { comoErrorClaveDuplicada } from '../errors/errorClaveDuplicada.js';

// Mensaje de respaldo si el Schema no definió uno propio para la
// patente repetida (ver comoErrorClaveDuplicada).
const MENSAJE_PATENTE_DUPLICADA = 'La patente ya está en uso';


export async function listar(): Promise<AutoDoc[]> {
  return AutoModel.find();
}


export async function obtenerPorId(id: string): Promise<AutoDoc | null> {
  return AutoModel.findById(id);
}


// create() puede chocar contra el índice unique de patente: se atrapa
// el error crudo de Mongo/Mongoose acá, no en el middleware, porque acá
// es donde se sabe qué campo es y qué mensaje tiene sentido para Auto.
export async function crear(datos: Auto): Promise<AutoDoc> {
  try {
    return await AutoModel.create(datos);
  } catch (err) {
    throw comoErrorClaveDuplicada(err, MENSAJE_PATENTE_DUPLICADA);
  }
}

// ============================================================
//  actualizar — modifica un auto existente
// ============================================================
// "cambios" trae solo los campos que el cliente quiere cambiar,
// por eso es Partial<Auto>. Devuelve el auto YA actualizado,
// o null si el id no existe.
export async function actualizar(
  id: string,
  cambios: Partial<Auto>,
): Promise<AutoDoc | null> {
  try {
    return await AutoModel.findByIdAndUpdate(id, cambios, {
      new: true, // devolver el documento actualizado, no el previo
      runValidators: true, // correr las validaciones del esquema también en el update
    });
  } catch (err) {
    // findByIdAndUpdate también puede chocar contra el índice unique
    // si "cambios.patente" coincide con la de otro auto.
    throw comoErrorClaveDuplicada(err, MENSAJE_PATENTE_DUPLICADA);
  }
}

// ============================================================
//  cambiarEstado — pone o saca un auto de servicio
// ============================================================
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

