// ============================================================
//  Profesor.ts — Modelo Mongoose de la colección "profesores"
// ============================================================

import { Schema, model, HydratedDocument } from 'mongoose';
import {
  calendarioSemanalSchema,
  crearCalendarioSemanal,
  type CalendarioSemanal,
} from './CalendarioSemanal.js';


// ============================================================
//  Definición del esquema
// ============================================================
const profesorSchema = new Schema(
  {
    nomApe: {
      type: String,
      required: [true, 'El nombre y apellido es obligatorio'],
      trim: true,
    },

    disponibilidad: {
      type: calendarioSemanalSchema,
      // arranca como { lunes: [], martes: [], ... }; el admin carga
      // los tramos de cada día después. Va como función (no como
      // objeto literal) para que cada profesor tenga SU propio
      // calendario y no compartan la misma instancia.
      default: crearCalendarioSemanal,
    },
  },
  {
    timestamps: true,

    collection: 'profesores',

    toJSON: {
      transform: (_doc, ret) => {
        // res.json(profesor): sacamos el __v (contador interno de
        // versión de Mongoose) para no ensuciar la respuesta.
        delete (ret as Record<string, unknown>).__v;
        return ret;
      },
    },
  },
);


export interface Profesor {
  nomApe: string;
  disponibilidad: CalendarioSemanal;
}

export type ProfesorDoc = HydratedDocument<Profesor>;

export const ProfesorModel = model<Profesor>(
  'Profesor',
  profesorSchema,
);
