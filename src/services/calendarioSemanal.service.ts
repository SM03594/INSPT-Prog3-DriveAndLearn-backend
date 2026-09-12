// ============================================================
//  calendarioSemanal.service.ts — Operaciones sobre un CalendarioSemanal
// ============================================================
// Un CalendarioSemanal es { lunes: [tramo], martes: [...], ... }.
// Acá viven las operaciones que lo modifican (agregar / quitar un
// tramo de un día).
// ============================================================

import {
  DIAS,
  type CalendarioSemanal,
  type Dia,
  type Tramo,
} from '../models/CalendarioSemanal.js';

// ============================================================
//  validarDia — rechaza un día que no está en DIAS
// ============================================================
export function validarDia(dia: string): void {
  if (!(DIAS as readonly string[]).includes(dia)) {
    throw new Error(
      `Día inválido: "${dia}". Debe ser uno de: ${DIAS.join(', ')}.`,
    );
  }
}

// ============================================================
//  agregarTramo — suma un tramo al día indicado
// ============================================================
export function agregarTramo(
  calendario: CalendarioSemanal,
  dia: Dia,
  tramo: Tramo,
): void {
  validarDia(dia);
  calendario[dia].push(tramo);
}

// ============================================================
//  quitarTramo — saca el tramo con ese _id del día indicado
// ============================================================
// Devuelve true si lo encontró y lo quitó; false si ese día no
// tenía ningún tramo con ese _id.
export function quitarTramo(
  calendario: CalendarioSemanal,
  dia: Dia,
  tramoId: string,
): boolean {
  validarDia(dia);

  const tramos = calendario[dia];
  const indice = tramos.findIndex((t) => t._id?.toString() === tramoId);
  if (indice === -1) return false;

  tramos.splice(indice, 1);
  return true;
}
