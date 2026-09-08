// ============================================================
//  Administrador.ts — Modelo Mongoose de la colección "administradores"
// ============================================================

import { Schema, model, HydratedDocument } from 'mongoose';


const administradorSchema = new Schema(
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
      // El hasheo se hace en el service antes de crear el administrador.
    },

    nomApe: {
      type: String,
      required: [true, 'El nombre y apellido es obligatorio'],
      trim: true,
    },
  },
  {
    timestamps: true,

    collection: 'administradores',

    toJSON: {
      transform: (_doc, ret) => {
        // res.json(admin): sacamos el __v (contador interno de versión de
        // Mongoose) y el password (aunque sea un hash, no debe salir de la API).
        delete (ret as Record<string, unknown>).__v;
        delete (ret as Record<string, unknown>).password;
        return ret;
      },
    },
  },
);


export interface AdministradorInterface {
  email: string;
  password: string; // en la base: hash de bcrypt
  nomApe: string;
}


export type AdministradorDoc = HydratedDocument<AdministradorInterface>;


export const AdministradorModel = model<AdministradorInterface>(
  'Administrador',
  administradorSchema,
);
