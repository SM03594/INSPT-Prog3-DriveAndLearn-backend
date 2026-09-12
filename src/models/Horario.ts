// ============================================================
//  Horario.ts — Piezas atómicas de horarios, compartidas
// ============================================================

import { Schema } from 'mongoose';

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

export interface HoraDelDia {
  hora: number; // 0–23
  minuto: number; // 0–59
}
