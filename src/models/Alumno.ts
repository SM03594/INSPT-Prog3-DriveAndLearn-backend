// ============================================================
//  Alumno.ts — Modelo Mongoose de la colección "alumnos"
// ============================================================

import { Schema, model, HydratedDocument } from 'mongoose';

// ============================================================
//  Definición del esquema
// ============================================================
const alumnoSchema = new Schema(
  {
    email: {
      type: String,
      required: [true, 'El email es obligatorio'],
      trim: true,
      lowercase: true,
      unique: true,
    },

    password: {
      type: String,
      required: [true, 'La contraseña es obligatoria'],
      // Guardamos el hash de bcrypt, nunca la contraseña en texto plano.
      // El hasheo se hace en el service antes de crear el alumno.
    },

    nomApe: {
      type: String,
      required: [true, 'El nombre y apellido es obligatorio'],
      trim: true,
    },

    clasesPorReservar: {
      type: Number,
      required: [true, 'La cantidad de clases por reservar es obligatoria'],
      min: [0, 'clasesPorReservar no puede ser negativo'],
      default: 0,
    },
  },
  {
    timestamps: true,

    collection: 'alumnos',

    toJSON: {
      transform: (_doc, ret) => {
        // res.json(alumno): sacamos el __v (contador interno de versión de
        // Mongoose) y el password (aunque sea un hash, no debe salir de la API).
        delete (ret as Record<string, unknown>).__v;
        delete (ret as Record<string, unknown>).password;
        return ret;
      },
    },
  },
);


export interface Alumno {
  email: string;
  password: string; // en la base: hash de bcrypt
  nomApe: string;
  clasesPorReservar: number;
}

export type AlumnoDoc = HydratedDocument<Alumno>;

export const AlumnoModel = model<Alumno>('Alumno', alumnoSchema);