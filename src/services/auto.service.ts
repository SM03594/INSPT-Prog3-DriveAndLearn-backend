// ============================================================
//  auto.service.ts — Capa de servicio de Autos
// ============================================================

import {
  AutoModel,
  type Auto,
  type AutoDoc,
<<<<<<< HEAD
=======
  type Auto,
>>>>>>> origin/main
} from '../models/Auto.js';

function esErrorDeClaveDuplicada(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}

export async function listar(): Promise<AutoDoc[]> {
  return AutoModel.find();
}

export async function obtenerPorId(id: string): Promise<AutoDoc | null> {
  return AutoModel.findById(id);
}

export async function crear(datos: Auto): Promise<AutoDoc> {
  try {
    return await AutoModel.create(datos);
  } catch (error) {
    if (esErrorDeClaveDuplicada(error)) {
      throw new Error('Ya existe un auto con esos datos.');
    }

<<<<<<< HEAD
    throw error;
  }
=======
export async function crear(datos: Auto): Promise<AutoDoc> {
  return AutoModel.create(datos);
>>>>>>> origin/main
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
      returnDocument: 'after',
      runValidators: true,
    });
  } catch (error) {
    if (esErrorDeClaveDuplicada(error)) {
      throw new Error('Ya existe un auto con esos datos.');
    }

    throw error;
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
    { returnDocument: 'after', runValidators: true },
  );
}

