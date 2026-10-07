// ============================================================
//  fechas.ts — Instantes (Date) y hora local de la escuela
// ============================================================
// Reglas de zona horaria del proyecto:
//   1) Entrada: solo ISO 8601 CON zona ("...Z" o "...-03:00").
//      Sin zona, JS lo interpretaría en la zona del server.
//   2) Guardado: Date en UTC (Mongo), no se toca.
//   3) Cálculos locales (día de la semana, hora de reloj): siempre con
//      Intl + ZONA_HORARIA, nunca getDay()/getHours(), que usan la
//      zona del proceso.
//   4) Salida: res.json serializa en ISO UTC; el frontend lo muestra.

import { ZONA_HORARIA } from '../config/env.js';
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
//  aHoraLocal — Date → día y hora tal como se ven en la escuela
// ============================================================
// Locale 'en-US' a propósito: los nombres de los días en inglés son
// estables y sin tildes, así el mapeo a Dia es seguro.
const DIA_POR_NOMBRE_EN: Record<string, Dia> = {
  Monday: 'lunes',
  Tuesday: 'martes',
  Wednesday: 'miercoles',
  Thursday: 'jueves',
  Friday: 'viernes',
  Saturday: 'sabado',
  Sunday: 'domingo',
};

// hourCycle 'h23': medianoche es 00, no 24.
const formatoLocal = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA_HORARIA,
  weekday: 'long',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

// Día de la semana + hora de reloj en la escuela.
// { dia: Dia } & HoraDelDia = { dia: Dia; hora: number; minuto: number }
export type HoraLocal = { dia: Dia } & HoraDelDia;

export function aHoraLocal(instante: Date): HoraLocal {
  const partes = Object.fromEntries(
    formatoLocal.formatToParts(instante).map((p) => [p.type, p.value]),
  );
  return {
    dia: DIA_POR_NOMBRE_EN[partes.weekday],
    hora: Number(partes.hour),
    minuto: Number(partes.minute),
  };
}
