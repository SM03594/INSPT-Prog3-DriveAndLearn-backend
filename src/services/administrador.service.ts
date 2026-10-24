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
} from '../models/Administrador.js';
import { verSiErrorClaveDuplicada } from '../errors/errorClaveDuplicada.js';
import { conPasswordHasheada } from '../utils/password.js';
import type {
  ActualizarAdministradorDto,
  CrearAdministradorDto,
} from '../dtos/administrador.dto.js';

const MENSAJE_EMAIL_DUPLICADO = 'La direccion de email ya esta en uso.';

// crear y actualizar reciben un DTO (ver dtos/administrador.dto.ts): la
// forma del dato ya la validó el controller. Ojo: si alguien llama al
// service sin pasar por el DTO, TypeScript lo frena al compilar, pero
// en runtime el service no vuelve a revisar la forma.

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
//  existe — si hay un administrador con ese _id
// ============================================================
// Usa exists() en vez de obtenerPorId para no traer el documento
// entero (con el hash de la contraseña) solo para chequear null.
// El discriminator filtra por rol, así que el id de un alumno
// devuelve false.
export async function existe(id: string): Promise<boolean> {
  return (await AdministradorModel.exists({ _id: id })) !== null;
}

// ============================================================
//  crear — alta de un administrador
// ============================================================
// Antes de guardar hasheamos la contraseña (ver utils/password.ts). El
// esquema sigue validando lo que depende del dato: que no esté vacío,
// el formato del email y que no esté repetido.
export async function crear(
  datos: CrearAdministradorDto,
): Promise<AdministradorDoc> {
  const datosAGuardar = await conPasswordHasheada(datos);

  try {
    return await AdministradorModel.create(datosAGuardar);
  } catch (err) {
    throw verSiErrorClaveDuplicada(err, MENSAJE_EMAIL_DUPLICADO);
  }
}

// ============================================================
//  actualizar — modifica un administrador existente
// ============================================================
// "cambios" trae solo los campos que el cliente quiere cambiar (el DTO
// ya rechazó los demás, incluidos los operadores como $set). Devuelve
// el administrador YA actualizado, o null si el id no existe. Si viene
// "password", se hashea igual que en crear.
export async function actualizar(
  id: string,
  cambios: ActualizarAdministradorDto,
): Promise<AdministradorDoc | null> {
  const cambiosAGuardar = await conPasswordHasheada(cambios);

  try {
    return await AdministradorModel.findByIdAndUpdate(id, cambiosAGuardar, {
      new: true, // devolver el documento actualizado, no el previo
      runValidators: true, // correr las validaciones del esquema también en el update
    });
  } catch (err) {
    throw verSiErrorClaveDuplicada(err, MENSAJE_EMAIL_DUPLICADO);
  }
}

export async function eliminar(
  id: string,
): Promise<AdministradorDoc | null> {
  return AdministradorModel.findByIdAndDelete(id);
}
