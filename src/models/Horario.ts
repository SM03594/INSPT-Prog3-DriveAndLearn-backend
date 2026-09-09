// ============================================================
//  Horario.ts — Sub-esquemas de horarios, compartidos
// ============================================================
// Piezas reutilizables para modelar "un día + una franja horaria":
// Este archivo NO define un modelo/colección propio: solo exporta
// los sub-esquemas y sus tipos para embeberlos en otros esquemas.

import { Schema, Types } from 'mongoose';

// --- Días de la semana válidos para un horario de disponibilidad ---
export const DIAS = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
] as const;

const MENSAJE_VALIDADOR_HORA = 'La hora debe estar entre 0 y 23';
const MENSAJE_VALIDADOR_MINUTO = 'Los minutos deben estar entre 0 y 59';

// ============================================================
//  Sub-esquema: una hora del día ({ hora, minuto })
// ============================================================
export const horaDelDiaSchema = new Schema(
  {
    hora: {
      type: Number,
      required: [true, 'La hora es obligatoria'],
      min: [0, MENSAJE_VALIDADOR_HORA],
      max: [23, MENSAJE_VALIDADOR_HORA],
      validate: {
        validator: Number.isInteger,
        message: 'La hora debe ser un número entero',
      },
    },
    minuto: {
      type: Number,
      required: [true, 'Los minutos son obligatorios'],
      min: [0, MENSAJE_VALIDADOR_MINUTO],
      max: [59, MENSAJE_VALIDADOR_MINUTO],
      validate: {
        validator: Number.isInteger,
        message: 'Los minutos deben ser un número entero',
      },
    },
  },
  { _id: false },
);

// Pasa { hora, minuto } a "minutos desde medianoche" para poder comparar.
export const aMinutos = (h: { hora: number; minuto: number }): number =>
  h.hora * 60 + h.minuto;

// ============================================================
//  Sub-esquema: un tramo de horario ("día + franja horaria")
// ============================================================
export const horarioSchema = new Schema({
  dia: {
    type: String,
    required: [true, 'El día del horario es obligatorio'],
    enum: {
      values: [...DIAS],
      message: 'día inválido (recibido: "{VALUE}")',
    },
  },
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
// posterior al inicio. Se corre cuando se valida el subdocumento
// (es decir, al hacer .save() del documento que lo contiene).
horarioSchema.pre('validate', async function () {
  const inicio = this.get('horaInicio') as HoraDelDia | undefined;
  const fin = this.get('horaFin') as HoraDelDia | undefined;

  if (inicio && fin && aMinutos(inicio) >= aMinutos(fin)) {
    this.invalidate(
      'horaFin',
      'La hora de fin debe ser posterior a la de inicio',
    );
  }
});


export interface HoraDelDia {
  hora: number; // 0–23
  minuto: number; // 0–59
}

export interface Horario {
  _id?: Types.ObjectId; // lo genera Mongoose al agregar el intervalo
  dia: (typeof DIAS)[number]; // 'lunes' | 'martes' | ... | 'domingo'
  horaInicio: HoraDelDia;
  horaFin: HoraDelDia;
}
