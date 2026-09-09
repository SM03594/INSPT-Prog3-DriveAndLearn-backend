// ============================================================
//  CalendarioSemanal.ts — Tramos horarios organizados por día
// ============================================================
//   {
//     lunes:  [ { horaInicio: {hora,minuto}, horaFin: {hora,minuto} }, ... ],
//     martes: [ ... ],
//     ...
//     domingo: [ ... ]
//   }


import { Schema, Types } from 'mongoose';
import {
  horaDelDiaSchema,
  aMinutos,
  type HoraDelDia,
} from './Horario.js';


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
//  Sub-esquema: un tramo (de una hora de inicio a una de fin)
// ============================================================
const tramoSchema = new Schema({
  horaInicio: {
    type: horaDelDiaSchema,
    required: [true, 'La hora de inicio es obligatoria'],
  },
  horaFin: {
    type: horaDelDiaSchema,
    required: [true, 'La hora de fin es obligatoria'],
  },
});

// Regla entre campos (validación a mano): el fin tiene que ser
// posterior al inicio. Corre al validar el subdocumento (o sea, al
// hacer .save() del documento que lo contiene).
tramoSchema.pre('validate', async function () {
  const inicio = this.get('horaInicio') as HoraDelDia | undefined;
  const fin = this.get('horaFin') as HoraDelDia | undefined;

  if (inicio && fin && aMinutos(inicio) >= aMinutos(fin)) {
    this.invalidate(
      'horaFin',
      'La hora de fin debe ser posterior a la de inicio',
    );
  }
});

// ============================================================
//  Sub-esquema: el calendario semanal (una lista de tramos por día)
// ============================================================
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
//  Tipos (para TypeScript) — escritos a mano
// ============================================================
export interface Tramo {
  _id?: Types.ObjectId; // lo genera Mongoose al agregar el tramo
  horaInicio: HoraDelDia;
  horaFin: HoraDelDia;
}

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
