// ============================================================
//  Profesor.ts — Modelo Mongoose de la colección "profesores"
// ============================================================

import { Schema, model, HydratedDocument } from 'mongoose';
import {
  calendarioSemanalSchema,
  crearCalendarioSemanal,
  type CalendarioSemanal,
} from './CalendarioSemanal.js';

const MAX_FOTO_BYTES: number = 2 * Math.pow(1024, 2); // 2 MiB


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

    fotoPerfil: {
      type: Buffer,
      // Opcional. Guarda los bytes de la imagen (el modelo de datos la define como "binary").
      validate: {
        validator: (buf?: Buffer | null) => buf == null || buf.length <= MAX_FOTO_BYTES,
        message: `La foto de perfil no puede superar los ${MAX_FOTO_BYTES / 1024 / 1024} MiB`,
      },
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
  fotoPerfil?: Buffer;
}

export type ProfesorDoc = HydratedDocument<Profesor>;

export const ProfesorModel = model<Profesor>(
  'Profesor',
  profesorSchema,
);
