// ============================================================
//  Alumno.ts — Discriminator "alumno" de la colección "usuarios"
// ============================================================
// Los campos comunes (email, password, nomApe, timestamps, toJSON)
// vienen del modelo base (Usuario.ts). Acá solo va lo propio del
// alumno.

import { Schema, HydratedDocument } from 'mongoose';
import {
  UsuarioModel,
  type DatosUsuario,
  type Usuario,
} from './Usuario.js';

// ============================================================
//  Definición del esquema
// ============================================================
const alumnoSchema = new Schema({
  clasesPorReservar: {
    type: Number,
    required: [true, 'La cantidad de clases por reservar es obligatoria'],
    min: [0, 'clasesPorReservar no puede ser negativo'],
    default: 0,
  },
});


// Campos que se cargan al crear un alumno ("rol" lo pone Mongoose).
export interface Alumno extends DatosUsuario {
  clasesPorReservar: number;
}

// Documento tal como queda guardado. Extiende Usuario (con el rol
// fijo) para que un AlumnoDoc sea también un UsuarioDoc.
export interface AlumnoGuardado extends Usuario, Alumno {
  rol: 'ALUMNO';
}

export type AlumnoDoc = HydratedDocument<AlumnoGuardado>;

// El nombre del modelo ('Alumno') es el que usan las referencias,
// como ref: 'Alumno' en Clase.ts. El valor ('alumno') es el que se
// guarda en el campo "role".
export const AlumnoModel = UsuarioModel.discriminator<AlumnoGuardado>(
  'Alumno',
  alumnoSchema,
  { value: 'ALUMNO' },
);
