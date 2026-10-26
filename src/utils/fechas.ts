// ============================================================
//  fechas.ts — Instantes (Date) y hora local de la escuela
// ============================================================
// Reglas de zona horaria del proyecto:
//   1) Entrada: solo ISO 8601 CON zona ("...Z" o "...-03:00").
//      Sin zona, JS lo interpretaría en la zona del server.
//   2) Guardado: Date en UTC (Mongo), no se toca.
//   3) Cálculos locales (día de la semana, hora de reloj, qué día es
//      hoy): siempre con OFFSET_UTC (config/env.ts), nunca
//      getDay()/getHours(), que usan la zona del proceso.
//   4) Salida: res.json serializa en ISO UTC; el frontend lo muestra.

import { OFFSET_UTC_MINUTOS } from '../config/env.js';
import { ErrorDeNegocio } from '../errors/errorDeNegocio.js';
import type { Dia } from '../models/CalendarioSemanal.js';
import type { HoraDelDia } from '../models/Horario.js';

// AAAA-MM-DDTHH:MM[:SS[.mmm]] seguido de Z o de un offset ±HH:MM.
// Las horas/minutos/segundos se acotan acá (00-23, 00-59).
const ISO_CON_ZONA =
  /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

// ¿Existe ese día en el calendario? (JS no lo garantiza: con hora,
// new Date('2026-02-31T09:00Z') no da Invalid Date, lo corre al 3/3.)
function esDiaDeCalendario(anio: number, mes: number, dia: number): boolean {
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  return d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

// ============================================================
//  parsearInstante — valor del body → Date sin ambigüedad
// ============================================================
// Acepta un Date (ya es un instante) o un string ISO con zona; con
// cualquier otra cosa lanza ErrorDeNegocio (400). undefined pasa
// tal cual, para que decida el "required" del Schema (en crear) o
// para que el campo no se toque (en actualizar).
export function parsearInstante(
  valor: unknown,
  campo: string,
): Date | undefined {
  if (valor === undefined) return undefined;

  let instante: Date | null = null;
  if (valor instanceof Date) {
    instante = valor;
  } else if (typeof valor === 'string') {
    const m = ISO_CON_ZONA.exec(valor);
    if (m && esDiaDeCalendario(Number(m[1]), Number(m[2]), Number(m[3]))) {
      instante = new Date(valor);
    }
  }

  if (instante === null || isNaN(instante.getTime())) {
    throw new ErrorDeNegocio(
      `${campo} debe ser una fecha ISO 8601 con zona horaria (ej. 2026-09-20T09:00:00-03:00)`,
    );
  }
  return instante;
}

// ============================================================
//  La hora de la escuela: el instante corrido por OFFSET_UTC
// ============================================================
const MS_POR_MINUTO = 60 * 1000;

// getUTCDay() devuelve 0 para el domingo, 1 para el lunes, etc.
const DIA_POR_INDICE: readonly Dia[] = [
  'domingo',
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
];

// Corre el instante por el offset de la escuela: los getUTC* del Date
// corrido dan la fecha y la hora que marca el reloj en la escuela.
// No es un instante real: solo sirve para leerle esos datos.
function relojDeLaEscuela(instante: Date): Date {
  const reloj = new Date(instante.getTime() + OFFSET_UTC_MINUTOS * MS_POR_MINUTO);
  return reloj;
}

// ============================================================
//  aHoraLocal — Date → día y hora tal como se ven en la escuela
// ============================================================
// Día de la semana + hora de reloj en la escuela.
// { dia: Dia } & HoraDelDia = { dia: Dia; hora: number; minuto: number }
export type HoraLocal = { dia: Dia } & HoraDelDia;

export function aHoraLocal(instante: Date): HoraLocal {
  const reloj = relojDeLaEscuela(instante);
  const horaLocal: HoraLocal = {
    dia: DIA_POR_INDICE[reloj.getUTCDay()],
    hora: reloj.getUTCHours(),
    minuto: reloj.getUTCMinutes(),
  };
  return horaLocal;
}

// ============================================================
//  FechaCalendario — un día del calendario, sin hora ni zona
// ============================================================
// { anio: 2026, mes: 11, diaDelMes: 9 } es el 9 de noviembre de 2026
// (mes de 1 a 12, como se escribe, no de 0 a 11 como en Date).
export interface FechaCalendario {
  anio: number;
  mes: number;
  diaDelMes: number;
}

// Milisegundos de esa fecha a las 00:00 UTC. Solo para comparar fechas
// o calcular su día de la semana: no es un instante de la escuela.
function comoUtc(fecha: FechaCalendario): number {
  const milisegundos = Date.UTC(fecha.anio, fecha.mes - 1, fecha.diaDelMes);
  return milisegundos;
}

// ============================================================
//  diaDeLaSemana — qué día de la semana es una fecha
// ============================================================
// Un día del calendario no depende de la zona horaria: el 9/11/2026 es
// lunes en todo el mundo. Por eso alcanza con Date.UTC.
export function diaDeLaSemana(fecha: FechaCalendario): Dia {
  const dia = DIA_POR_INDICE[new Date(comoUtc(fecha)).getUTCDay()];
  return dia;
}

// ============================================================
//  hoyEnLaEscuela — la fecha de hoy según el reloj de la escuela
// ============================================================
// A las 01:00 UTC todavía es "ayer" en la escuela (con -03:00).
// "ahora" se puede pasar para los tests.
export function hoyEnLaEscuela(ahora: Date = new Date()): FechaCalendario {
  const reloj = relojDeLaEscuela(ahora);
  const hoy: FechaCalendario = {
    anio: reloj.getUTCFullYear(),
    mes: reloj.getUTCMonth() + 1,
    diaDelMes: reloj.getUTCDate(),
  };
  return hoy;
}

// ============================================================
//  compararFechas — < 0 si a es anterior, 0 si es la misma, > 0 si es posterior
// ============================================================
export function compararFechas(a: FechaCalendario, b: FechaCalendario): number {
  const diferencia = comoUtc(a) - comoUtc(b);
  return diferencia;
}

// ============================================================
//  instanteLocal — fecha + hora de la escuela → Date
// ============================================================
// El camino inverso de aHoraLocal, con el mismo offset: por eso
// aHoraLocal(instanteLocal(fecha, hora)) devuelve siempre esa hora.
// "9/11/2026 a las 09:00" con -03:00 → 2026-11-09T12:00:00.000Z
export function instanteLocal(fecha: FechaCalendario, hora: HoraDelDia): Date {
  const comoSiFueraUtc = Date.UTC(
    fecha.anio,
    fecha.mes - 1,
    fecha.diaDelMes,
    hora.hora,
    hora.minuto,
  );
  const instante = new Date(comoSiFueraUtc - OFFSET_UTC_MINUTOS * MS_POR_MINUTO);
  return instante;
}

// ============================================================
//  formatearFecha — FechaCalendario → "AAAA-MM-DD"
// ============================================================
export function formatearFecha(fecha: FechaCalendario): string {
  const dosDigitos = (numero: number) => String(numero).padStart(2, '0');
  const texto = `${fecha.anio}-${dosDigitos(fecha.mes)}-${dosDigitos(fecha.diaDelMes)}`;
  return texto;
}
