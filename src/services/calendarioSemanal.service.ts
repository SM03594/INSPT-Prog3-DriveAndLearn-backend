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
} from '../models/CalendarioSemanal.js';
import type { Tramo } from '../models/Tramo.js';
import { ErrorDeNegocio } from '../errors/errorDeNegocio.js';
import { validarTramoEnPunto } from './tramo.service.js';

// ============================================================
//  validarDia — rechaza un día que no está en DIAS
// ============================================================
export function validarDia(dia: string): asserts dia is Dia {
  if (!(DIAS as readonly string[]).includes(dia)) {
    throw new ErrorDeNegocio(
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
  validarTramoEnPunto(tramo);
  calendario[dia].push(tramo);
}

// ============================================================
//  validarTramosEnPunto — todos los tramos de la semana, en punto
// ============================================================
// Para cuando se carga un calendario entero (por ejemplo, el PUT del
// horario de la escuela).
export function validarTramosEnPunto(calendario: CalendarioSemanal): void {
  for (const dia of DIAS) {
    calendario[dia].forEach(validarTramoEnPunto);
  }
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
  const seEncontroElTramo = indice !== -1;

  if (seEncontroElTramo) {
    tramos.splice(indice, 1);
  }

  return seEncontroElTramo;
}
