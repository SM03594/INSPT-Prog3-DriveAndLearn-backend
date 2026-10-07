// ============================================================
//  clase.service.ts — Capa de servicio de Clases
// ============================================================

import { ClaseModel, type ClaseDoc, type Clase } from '../models/Clase.js';
import { parsearInstante } from '../utils/fechas.js';

// Lo que llega del body: inicio/fin vienen como string ISO (JSON no
// tiene Date), o como Date si el service se llama desde código.
export type DatosClase = Omit<Clase, 'inicio' | 'fin'> & {
  inicio: Date | string;
  fin: Date | string;
};

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
export async function crear(datos: DatosClase): Promise<ClaseDoc> {
  return ClaseModel.create({
    ...datos,
    inicio: parsearInstante(datos.inicio, 'inicio'),
    fin: parsearInstante(datos.fin, 'fin'),
  });
}

// ============================================================
//  actualizar — modifica una clase existente
// ============================================================
export async function actualizar(
  id: string,
  cambios: Partial<DatosClase>,
): Promise<ClaseDoc | null> {
  // Solo se pisan inicio/fin si vinieron en el body.
  const { inicio, fin, ...resto } = cambios;
  const update: Partial<Clase> = { ...resto };
  if (inicio !== undefined) update.inicio = parsearInstante(inicio, 'inicio');
  if (fin !== undefined) update.fin = parsearInstante(fin, 'fin');

  return ClaseModel.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
  });
}

/*
  Pendiente validar que el profesor y el auto
  tengan el horario libre para crear y actualizar
*/


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
