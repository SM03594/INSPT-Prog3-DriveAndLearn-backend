// ============================================================
//  clase.service.ts — Capa de servicio de Clases
// ============================================================

import { ClaseModel, type ClaseDoc, type Clase } from '../models/Clase.js';

// ============================================================
//  listar — todas las clases
// ============================================================
export async function listar(): Promise<ClaseDoc[]> {
  return ClaseModel.find();
}

// ============================================================
//  obtenerPorId — una clase por su _id (null si no existe)
// ============================================================
export async function obtenerPorId(id: string): Promise<ClaseDoc | null> {
  return ClaseModel.findById(id);
}

// ============================================================
//  crear — alta de una clase
// ============================================================
export async function crear(datos: Clase): Promise<ClaseDoc> {
  return ClaseModel.create(datos);
}

// ============================================================
//  actualizar — modifica una clase existente
// ============================================================
export async function actualizar(
  id: string,
  cambios: Partial<Clase>,
): Promise<ClaseDoc | null> {
  return ClaseModel.findByIdAndUpdate(id, cambios, {
    new: true,
    runValidators: true,
  });
}

// ============================================================
//  cancelar — marca una clase como cancelada
// ============================================================
export async function cancelar(id: string): Promise<ClaseDoc | null> {
  return ClaseModel.findByIdAndUpdate(
    id,
    { estado: 'cancelada' },
    {
      new: true,
      runValidators: true,
    },
  );
}
