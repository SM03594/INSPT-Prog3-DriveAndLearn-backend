// ============================================================
//  auto.service.ts — Capa de servicio de Autos
// ============================================================

import { AutoModel, type AutoDoc } from '../models/Auto.js';

// Campos que aceptamos al crear o actualizar un auto. El
// controller ya se encarga de que al service NUNCA le lleguen
// otros campos (por ejemplo un _id inventado por el cliente).
export interface DatosAuto {
  marca: string;
  modelo: string;
  patente: string;
  cambios: string;
  activo: boolean;
}


export async function listar(): Promise<AutoDoc[]> {
  return AutoModel.find();
}


export async function obtenerPorId(id: string): Promise<AutoDoc | null> {
  return AutoModel.findById(id);
}


export async function crear(datos: DatosAuto): Promise<AutoDoc> {
  return AutoModel.create(datos);
}

// ============================================================
//  actualizar — modifica un auto existente
// ============================================================
// "cambios" trae solo los campos que el cliente quiere cambiar,
// por eso es Partial<DatosAuto>. Devuelve el auto YA actualizado,
// o null si el id no existe.
export async function actualizar(
  id: string,
  cambios: Partial<DatosAuto>,
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

