// ============================================================
//  CalendarioSemanal.ts — Tramos horarios organizados por día
// ============================================================
//   {
//     lunes:  [ { horaInicio: {hora,minuto}, horaFin: {hora,minuto} }, ... ],
//     martes: [ ... ],
//     ...
//     domingo: [ ... ]
//   }


import { Schema } from 'mongoose';
import { tramoSchema, type Tramo } from './Tramo.js';


// --- Días de la semana válidos ---
export const DIAS = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
] as const;

// 'lunes' | 'martes' | ... | 'domingo'
export type Dia = (typeof DIAS)[number];

// ============================================================
//  Sub-esquema: el calendario semanal (una lista de tramos por día)
// ============================================================
// Cada tramo usa el sub-esquema de Tramo.ts.
// Un campo por día, cada uno arranca como array vacío. Las claves
// tienen que coincidir con DIAS (el tipo de más abajo lo deriva de
// ahí, así que si agregás un día, TS te obliga a sumar la clave).
export const calendarioSemanalSchema = new Schema(
  {
    lunes: { type: [tramoSchema], default: [] },
    martes: { type: [tramoSchema], default: [] },
    miercoles: { type: [tramoSchema], default: [] },
    jueves: { type: [tramoSchema], default: [] },
    viernes: { type: [tramoSchema], default: [] },
    sabado: { type: [tramoSchema], default: [] },
    domingo: { type: [tramoSchema], default: [] },
  },
  { _id: false },
);

// ============================================================
//  Tipo (para TypeScript) — escrito a mano
// ============================================================
// { lunes: Tramo[]; martes: Tramo[]; ...; domingo: Tramo[] }
export type CalendarioSemanal = Record<Dia, Tramo[]>;

// ============================================================
//  crearCalendarioSemanal — un calendario vacío
// ============================================================
export function crearCalendarioSemanal(): CalendarioSemanal {
  return {
    lunes: [],
    martes: [],
    miercoles: [],
    jueves: [],
    viernes: [],
    sabado: [],
    domingo: [],
  };
}
