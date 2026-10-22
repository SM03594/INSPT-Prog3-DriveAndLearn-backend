// ============================================================
//  Usuario.ts — Modelo base de la colección "usuarios"
// ============================================================

import { Schema, model } from 'mongoose';
// Solo tipos: se borran al compilar, así que no generan un import
// circular en tiempo de ejecución (Alumno.ts y Administrador.ts
// importan UsuarioModel de este archivo).
import type { AlumnoDoc } from './Alumno.js';
import type { AdministradorDoc } from './Administrador.js';
import { ROLES, type Rol } from '../types/roles.js';


const usuarioSchema = new Schema(
  {
    // Lo completa Mongoose con el valor del discriminator. Se declara
    // igual para que quede tipado y para que el enum impida guardar
    // un usuario sin rol (por ejemplo, creándolo con UsuarioModel).
    rol: {
      type: String,
      required: [true, 'El rol es obligatorio'],
      enum: {
        values: [...ROLES],
        message: 'rol debe ser "alumno" o "administrador"',
      },
    },

    email: {
      type: String,
      required: [true, 'El email es obligatorio'],
      trim: true,
      lowercase: true,
      unique: [true, 'La direccion de email ya esta en uso.'],
      // algo@algo.algo, sin espacios. Corre después de trim y
      // lowercase, y también en los updates con runValidators.
      // Ojo: .save() lo vuelve a validar aunque no cambie el email,
      // así que un email inválido guardado de antes bloquea ese save().
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'El email no tiene un formato válido'],
    },

    password: {
      type: String,
      required: [true, 'La contraseña es obligatoria'],
    },

    nomApe: {
      type: String,
      required: [true, 'El nombre y apellido es obligatorio'],
      trim: true,
    },
  },
  {
    timestamps: true,

    collection: 'usuarios',

    discriminatorKey: 'rol',

    // Los discriminators heredan estas opciones, así que el transform
    // aplica también a alumnos y administradores.
    toJSON: {
      transform: (_doc, ret) => {
        // res.json(usuario): sacamos el __v (contador interno de versión de
        // Mongoose) y el password (aunque sea un hash, no debe salir de la API).
        delete (ret as Record<string, unknown>).__v;
        delete (ret as Record<string, unknown>).password;
        return ret;
      },
    },
  },
);


// Campos que se cargan al crear cualquier usuario. "rol" no está
// porque lo pone Mongoose según el modelo con el que se crea.
export interface DatosUsuario {
  email: string;
  password: string; // en la base: hash de bcrypt
  nomApe: string;
}

// Documento tal como queda guardado.
export interface Usuario extends DatosUsuario {
  rol: Rol;
}

// UsuarioDoc puede contener a AlumnoDoc o AdministradorDoc
export type UsuarioDoc = AlumnoDoc | AdministradorDoc;

export const UsuarioModel = model<Usuario>('Usuario', usuarioSchema);
