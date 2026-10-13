import { model, Schema } from 'mongoose';
import {
  calendarioSemanalSchema,
  crearCalendarioSemanal,
  type CalendarioSemanal,
} from './CalendarioSemanal.js';

const horarioEscuelaSchema = new Schema(
  {
    _id: { type: String, default: 'escuela' },
    calendario: {
      type: calendarioSemanalSchema,
      required: true,
      default: crearCalendarioSemanal,
    },
  },
  {
    collection: 'horario_escuela',
    versionKey: false,
  },
);

export interface HorarioEscuela {
  _id: string;
  calendario: CalendarioSemanal;
}

export const HorarioEscuelaModel = model<HorarioEscuela>(
  'HorarioEscuela',
  horarioEscuelaSchema,
);
