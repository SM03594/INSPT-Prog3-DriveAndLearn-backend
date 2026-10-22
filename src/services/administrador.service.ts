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
import { verSiErrorClaveDuplicada } from '../errors/errorClaveDuplicada.js';
import { conPasswordHasheada } from '../utils/password.js';
import { ErrorDeNegocio } from '../errors/errorDeNegocio.js';

const MENSAJE_EMAIL_DUPLICADO = 'La direccion de email ya esta en uso.';
const CAMPOS_ADMINISTRADOR = ['email', 'password', 'nomApe'] as const;

function validarDatosAdministrador(
  datosEntrada: unknown,
): Partial<Administrador> {
  if (
    typeof datosEntrada !== 'object' ||
    datosEntrada === null ||
    Array.isArray(datosEntrada)
  ) {
    throw new ErrorDeNegocio('El cuerpo de la petición debe ser un objeto JSON');
  }

  const datos = datosEntrada as Record<string, unknown>;
  const camposNoPermitidos = Object.keys(datos).filter(
    (campo) =>
      !CAMPOS_ADMINISTRADOR.includes(
        campo as (typeof CAMPOS_ADMINISTRADOR)[number],
      ),
  );
  if (camposNoPermitidos.length > 0) {
    throw new ErrorDeNegocio(
      `Campos no permitidos: ${camposNoPermitidos.join(', ')}`,
    );
  }

  for (const campo of CAMPOS_ADMINISTRADOR) {
    const valor = datos[campo];
    if (valor !== undefined && typeof valor !== 'string') {
      throw new ErrorDeNegocio(`${campo} debe ser un texto`);
    }
  }

  return datos as Partial<Administrador>;
}

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
// Antes de guardar hasheamos la contraseña (ver utils/password.ts).
// Si "password" no vino, el validador "required" del esquema
// rechaza la creación con un ValidationError.
export async function crear(
  datosEntrada: unknown,
): Promise<AdministradorDoc> {
  const datos = validarDatosAdministrador(datosEntrada);
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
// "cambios" trae solo los campos que el cliente quiere cambiar,
// por eso es Partial<Administrador>. Devuelve el
// administrador YA actualizado, o null si el id no existe. Si
// viene "password", se hashea igual que en crear.
export async function actualizar(
  id: string,
  cambiosEntrada: unknown,
): Promise<AdministradorDoc | null> {
  const cambios = validarDatosAdministrador(cambiosEntrada);
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
