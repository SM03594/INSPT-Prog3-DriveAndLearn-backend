// ============================================================
//  auto.service.ts — Capa de servicio de Autos
// ============================================================

import {
  AutoModel,
  type AutoDoc,
  type AutoInterface,
} from '../models/Auto.js';


export async function listar(): Promise<AutoDoc[]> {
  return AutoModel.find();
}


export async function obtenerPorId(id: string): Promise<AutoDoc | null> {
  return AutoModel.findById(id);
}


export async function crear(datos: AutoInterface): Promise<AutoDoc> {
  return AutoModel.create(datos);
}

// ============================================================
//  actualizar — modifica un auto existente
// ============================================================
// "cambios" trae solo los campos que el cliente quiere cambiar,
// por eso es Partial<AutoInterface>. Devuelve el auto YA actualizado,
// o null si el id no existe.
export async function actualizar(
  id: string,
  cambios: Partial<AutoInterface>,
): Promise<AutoDoc | null> {
  return AutoModel.findByIdAndUpdate(id, cambios, {
    new: true, // devolver el documento actualizado, no el previo
    runValidators: true, // correr las validaciones del esquema también en el update
  });
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

