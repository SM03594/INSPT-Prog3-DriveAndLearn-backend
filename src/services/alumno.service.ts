// ============================================================
//  alumno.service.ts — Capa de servicio de Alumnos
// ============================================================


import {
  AlumnoModel,
  type AlumnoDoc,
  type Alumno,
} from '../models/Alumno.js';
import { ErrorDeNegocio } from '../errors/errorDeNegocio.js';
import { comoErrorClaveDuplicada } from '../errors/errorClaveDuplicada.js';
import { conPasswordHasheada } from '../utils/password.js';


// Mensaje de respaldo si el Schema no definió uno propio para el
// email repetido (ver comoErrorClaveDuplicada).
const MENSAJE_EMAIL_DUPLICADO = 'La direccion de email ya esta en uso.';

// ============================================================
//  listar — todos los alumnos
// ============================================================
export async function listar(): Promise<AlumnoDoc[]> {
  return AlumnoModel.find();
}

// ============================================================
//  obtenerPorId — un alumno por su _id (null si no existe)
// ============================================================
// Si el id no tiene forma de ObjectId, Mongoose lanza un
// CastError (el controller lo traduce a 400).
export async function obtenerPorId(id: string): Promise<AlumnoDoc | null> {
  return AlumnoModel.findById(id);
}

// ============================================================
//  crear — alta de un alumno
// ============================================================
// Antes de guardar hasheamos la contraseña (ver utils/password.ts).
// Si "password" no vino, el validador "required" del esquema
// rechaza la creación con un ValidationError.
export async function crear(datos: Alumno): Promise<AlumnoDoc> {
  const datosAGuardar = await conPasswordHasheada(datos);

  try {
    return await AlumnoModel.create(datosAGuardar);
  } catch (err) {
    throw comoErrorClaveDuplicada(err, MENSAJE_EMAIL_DUPLICADO);
  }
}

// ============================================================
//  actualizar — modifica un alumno existente
// ============================================================
// "cambios" trae solo los campos que el cliente quiere cambiar,
// por eso es Partial<DatosAlumno>. Devuelve el alumno YA
// actualizado, o null si el id no existe. Si viene "password",
// se hashea igual que en crear.
export async function actualizar(
  id: string,
  cambios: Partial<Alumno>,
): Promise<AlumnoDoc | null> {
  const cambiosAGuardar = await conPasswordHasheada(cambios);

  try {
    return await AlumnoModel.findByIdAndUpdate(id, cambiosAGuardar, {
      new: true, // devolver el documento actualizado, no el previo
      runValidators: true, // correr las validaciones del esquema también en el update
    });
  } catch (err) {
    throw comoErrorClaveDuplicada(err, MENSAJE_EMAIL_DUPLICADO);
  }
}

// ============================================================
//  ajustarClasesPorReservar — helper interno
// ============================================================
// Suma "delta" (positivo o negativo) al saldo de clases del
// alumno y guarda. Usa findById + save (en vez de $inc) para que
// el validador min:0 del esquema corra siempre sobre el valor
// final: si el saldo quedara negativo, save() lanza ValidationError.
// Devuelve null si el alumno no existe.
async function ajustarClasesPorReservar(
  id: string,
  delta: number,
): Promise<AlumnoDoc | null> {
  const alumno = await AlumnoModel.findById(id);
  if (alumno === null) return null;

  alumno.clasesPorReservar += delta;

  return alumno.save();
}

// ============================================================
//  sumarClasesPorReservar — le suma N clases al saldo
// ============================================================
// "cantidad" es un delta a sumar (no el valor final) y no puede
// ser negativo.
export async function sumarClasesPorReservar(
  id: string,
  cantidad: number,
): Promise<AlumnoDoc | null> {
  if (cantidad < 0) {
    throw new ErrorDeNegocio('La cantidad a sumar no puede ser negativa');
  }
  return ajustarClasesPorReservar(id, cantidad);
}

// ============================================================
//  restarClasesPorReservar — le resta N clases al saldo
// ============================================================
// "cantidad" es un delta a restar (no el valor final) y no puede
// ser negativo. Si el saldo quedara por debajo de 0, el validador
// min:0 del esquema lo rechaza.
export async function restarClasesPorReservar(
  id: string,
  cantidad: number,
): Promise<AlumnoDoc | null> {
  if (cantidad < 0) {
    throw new ErrorDeNegocio('La cantidad a restar no puede ser negativa');
  }
  return ajustarClasesPorReservar(id, -cantidad);
}