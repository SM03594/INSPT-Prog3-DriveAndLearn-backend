// ============================================================
//  tramo.service.ts — Reglas de negocio de un tramo horario
// ============================================================
// Un tramo se carga en el horario de la escuela o en la disponibilidad
// de un profesor, y en los dos casos tiene que empezar y terminar en
// una hora en punto (08:00–12:00 sí; 08:30–12:00 o 09:00–12:30, no).
//
// La regla está acá y no en el esquema a propósito: save() vuelve a
// validar todos los tramos del documento, así que un tramo viejo que
// no es en punto bloquearía cualquier cambio en su calendario. Desde
// el service solo se revisan los tramos que se cargan.
//
// También están acá las cuentas con tramos que comparten la reserva de
// una clase y la consulta de turnos libres, para que las dos usen
// exactamente la misma regla.

import { aMinutos, type HoraDelDia } from '../models/Horario.js';
import type { Tramo } from '../models/Tramo.js';
import { ErrorDeNegocio } from '../errors/errorDeNegocio.js';

// El tramo llega del cliente con las horas sin revisar (las valida el
// esquema al guardar), así que acá puede faltar una hora o venir un
// minuto que no es un número. Solo se mira un minuto que, convertido
// a número, está entre 1 y 59: el texto "30" cuenta (Mongoose lo
// guardaría como 30). Si falta, no es un número o está fuera de rango,
// el mensaje lo da el esquema.
function tieneMinutos(hora: HoraDelDia | undefined): boolean {
  const minuto = Number(hora?.minuto);
  const esUnMinutoDistintoDeCero = minuto > 0 && minuto < 60;
  return esUnMinutoDistintoDeCero;
}

// ============================================================
//  validarTramoEnPunto — el tramo empieza y termina en una hora en punto
// ============================================================
export function validarTramoEnPunto(tramo: Tramo): void {
  const noEsEnPunto = tieneMinutos(tramo.horaInicio) || tieneMinutos(tramo.horaFin);

  if (noEsEnPunto) {
    throw new ErrorDeNegocio('Los tramos deben empezar y terminar en una hora en punto');
  }
}

// ============================================================
//  IntervaloMinutos — un tramo pasado a minutos desde medianoche
// ============================================================
// 09:00–12:30 → { inicio: 540, fin: 750 }. El fin no se incluye: una
// clase de 11 a 12 y otra de 12 a 13 no se pisan.
export interface IntervaloMinutos {
  inicio: number;
  fin: number;
}

export function aIntervalo(tramo: Tramo): IntervaloMinutos {
  const intervalo = { inicio: aMinutos(tramo.horaInicio), fin: aMinutos(tramo.horaFin) };
  return intervalo;
}

// ============================================================
//  entraEnAlgunTramo — ¿el intervalo entra ENTERO en un mismo tramo?
// ============================================================
// Entero y en uno solo: con 08–10 y 10–12, una clase de 09:30 a 10:30
// no entra, aunque los dos tramos juntos la cubran.
export function entraEnAlgunTramo(
  tramos: readonly Tramo[],
  intervalo: IntervaloMinutos,
): boolean {
  const entra = tramos.some((tramo) => {
    const delTramo = aIntervalo(tramo);
    return delTramo.inicio <= intervalo.inicio && intervalo.fin <= delTramo.fin;
  });
  return entra;
}

// ============================================================
//  cruzarIntervalos — la parte que tienen en común (null si no se tocan)
// ============================================================
// 09–13 y 08–12 → 09–12. 09–10 y 10–12 → null (solo se tocan en un
// punto, no comparten ningún minuto).
export function cruzarIntervalos(
  a: IntervaloMinutos,
  b: IntervaloMinutos,
): IntervaloMinutos | null {
  const inicio = Math.max(a.inicio, b.inicio);
  const fin = Math.min(a.fin, b.fin);
  const comparten = inicio < fin;
  return comparten ? { inicio, fin } : null;
}
