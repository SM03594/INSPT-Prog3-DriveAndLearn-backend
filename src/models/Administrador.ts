// ============================================================
//  Administrador.ts — Discriminator "administrador" de la colección "usuarios"
// ============================================================
// El administrador no tiene campos propios: todo lo que guarda
// (email, password, nomApe, timestamps) viene del modelo base
// (Usuario.ts). El discriminator existe para que AdministradorModel
// filtre solo los usuarios con rol "administrador".

import { Schema, HydratedDocument } from 'mongoose';
import {
  UsuarioModel,
  type DatosUsuario,
  type Usuario,
} from './Usuario.js';


// Campos que se cargan al crear un administrador ("rol" lo pone Mongoose).
export type Administrador = DatosUsuario;

// Documento tal como queda guardado. Extiende Usuario (con el rol
// fijo) para que un AdministradorDoc sea también un UsuarioDoc.
export interface AdministradorGuardado extends Usuario {
  rol: 'administrador';
}

export type AdministradorDoc = HydratedDocument<AdministradorGuardado>;

export const AdministradorModel = UsuarioModel.discriminator<AdministradorGuardado>(
  'Administrador',
  new Schema({}),
  { value: 'administrador' },
);
