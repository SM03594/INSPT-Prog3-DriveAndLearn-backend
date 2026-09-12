// ============================================================
//  Alumno.ts — Modelo Mongoose de la colección "alumnos"
// ============================================================

import { Schema, model, HydratedDocument, InferSchemaType } from 'mongoose';

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


<<<<<<< HEAD
export type Alumno = InferSchemaType<typeof alumnoSchema>;

// Alias compatible con el proyecto actual, pero el origen de verdad
// pasa a ser el esquema y no una interface duplicada.
export type AlumnoInterface = Alumno;

export type AlumnoDoc = HydratedDocument<Alumno>;

=======
export interface Alumno {
  email: string;
  password: string; // en la base: hash de bcrypt
  nomApe: string;
  clasesPorReservar: number;
}

export type AlumnoDoc = HydratedDocument<Alumno>;

>>>>>>> origin/main
export const AlumnoModel = model<Alumno>('Alumno', alumnoSchema);
