// ============================================================
//  administrador.service.ts — Capa de servicio de Administradores
// ============================================================
// Misma idea que alumno.service.ts: acá vive la lógica de negocio
// y TODO el acceso a datos. No sabe nada de req/res/HTTP.
// Devuelve null cuando algo "no se encontró".
// ============================================================

import {
  AdministradorModel,
  type AdministradorDoc,
  type Administrador,
} from '../models/Administrador.js';
import { conPasswordHasheada } from '../utils/password.js';

// La forma del administrador (los campos que aceptamos al
// crear/actualizar) vive en el model, como Administrador.

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
// Antes de guardar hasheamos la contraseña (ver utils/password.ts).
// Si "password" no vino, el validador "required" del esquema
// rechaza la creación con un ValidationError.
export async function crear(
  datos: Administrador,
): Promise<AdministradorDoc> {
  return AdministradorModel.create(await conPasswordHasheada(datos));
}

// ============================================================
//  actualizar — modifica un administrador existente
// ============================================================
// "cambios" trae solo los campos que el cliente quiere cambiar,
// por eso es Partial<Administrador>. Devuelve el
// administrador YA actualizado, o null si el id no existe. Si
// viene "password", se hashea igual que en crear.
export async function actualizar(
  id: string,
  cambios: Partial<Administrador>,
): Promise<AdministradorDoc | null> {
  const cambiosAGuardar = await conPasswordHasheada(cambios);

  return AdministradorModel.findByIdAndUpdate(id, cambiosAGuardar, {
    new: true, // devolver el documento actualizado, no el previo
    runValidators: true, // correr las validaciones del esquema también en el update
  });
}
