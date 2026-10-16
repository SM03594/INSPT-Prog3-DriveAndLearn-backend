// ============================================================
//  usuario.service.ts — Capa de servicio de Usuarios (todos los roles)
// ============================================================
// A diferencia de alumno.service.ts y administrador.service.ts,
// trabaja sobre el modelo base (UsuarioModel), así que ve la
// colección "usuarios" completa: alumnos y administradores juntos.
// ============================================================

import { UsuarioModel, type UsuarioDoc } from '../models/Usuario.js';

// ============================================================
//  listar — todos los usuarios, de cualquier rol
// ============================================================
// Mongoose hidrata cada documento con el modelo de su discriminator
// según el campo "rol": los alumnos vuelven como AlumnoDoc y los
// administradores como AdministradorDoc. El tipo de find() sobre el
// modelo base no lo refleja, por eso el "as".
export async function listar(): Promise<UsuarioDoc[]> {
  return (await UsuarioModel.find()) as UsuarioDoc[];
}

// ============================================================
//  obtenerPorId — un usuario por su _id (null si no existe)
// ============================================================
// Si el id no tiene forma de ObjectId, Mongoose lanza un
// CastError (el controller lo traduce a 400).
export async function obtenerPorId(id: string): Promise<UsuarioDoc | null> {
  return (await UsuarioModel.findById(id)) as UsuarioDoc | null;
}

// ============================================================
//  obtenerPorEmail — un usuario por su email (null si no existe)
// ============================================================
export async function obtenerPorEmail(
  email: string,
): Promise<UsuarioDoc | null> {
  const emailNormalizado = email.trim().toLowerCase();
  return (await UsuarioModel.findOne({
    email: emailNormalizado,
  })) as UsuarioDoc | null;
}
