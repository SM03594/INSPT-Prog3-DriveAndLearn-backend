// ============================================================
//  administrador.service.ts — Capa de servicio de Administradores
// ============================================================
// Misma idea que alumno.service.ts: acá vive la lógica de negocio
// y TODO el acceso a datos. No sabe nada de req/res/HTTP.
// Devuelve null cuando algo "no se encontró".
// ============================================================

import bcrypt from 'bcrypt';
import {
  AdministradorModel,
  type AdministradorDoc,
  type AdministradorInterface,
} from '../models/Administrador.js';

// La forma del administrador (los campos que aceptamos al
// crear/actualizar) vive en el model, como AdministradorInterface.

// Cantidad de rondas de sal que usa bcrypt para hashear.
const BCRYPT_ROUNDS = 10;

// ============================================================
//  listar — todos los administradores
// ============================================================
export async function listar(): Promise<AdministradorDoc[]> {
  return AdministradorModel.find();
}

// ============================================================
//  obtenerPorId — un administrador por su _id (null si no existe)
// ============================================================
export async function obtenerPorId(
  id: string,
): Promise<AdministradorDoc | null> {
  return AdministradorModel.findById(id);
}

// ============================================================
//  crear — alta de un administrador
// ============================================================
// Antes de guardar hasheamos la contraseña: en la base nunca
// queda el texto plano. Si "password" no vino, NO llamamos a
// bcrypt: dejamos que sea el validador "required" del esquema
// el que rechace la creación con un ValidationError.
export async function crear(
  datos: AdministradorInterface,
): Promise<AdministradorDoc> {
  const datosAGuardar =
    typeof datos.password === 'string'
      ? { ...datos, password: await bcrypt.hash(datos.password, BCRYPT_ROUNDS) }
      : datos;

  return AdministradorModel.create(datosAGuardar);
}

// ============================================================
//  actualizar — modifica un administrador existente
// ============================================================
// "cambios" trae solo los campos que el cliente quiere cambiar,
// por eso es Partial<AdministradorInterface>. Devuelve el
// administrador YA actualizado, o null si el id no existe.
export async function actualizar(
  id: string,
  cambios: Partial<AdministradorInterface>,
): Promise<AdministradorDoc | null> {
  return AdministradorModel.findByIdAndUpdate(id, cambios, {
    new: true, // devolver el documento actualizado, no el previo
    runValidators: true, // correr las validaciones del esquema también en el update
  });
}
