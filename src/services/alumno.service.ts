// ============================================================
//  alumno.service.ts — Capa de servicio de Alumnos
// ============================================================


import {
  AlumnoModel,
  type AlumnoDoc,
} from '../models/Alumno.js';
import { ErrorDeNegocio } from '../errors/errorDeNegocio.js';
import { verSiErrorClaveDuplicada } from '../errors/errorClaveDuplicada.js';
import { conPasswordHasheada } from '../utils/password.js';
import type { ActualizarAlumnoDto, CrearAlumnoDto } from '../dtos/alumno.dto.js';


// Mensaje de respaldo si el Schema no definió uno propio para el
// email repetido (ver verSiErrorClaveDuplicada).
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

// "datos" ya es un CrearAlumnoDto: la forma la validó el controller
// (ver dtos/alumno.dto.ts). Acá se aplican las reglas: el saldo
// inicial lo fija el service, nunca el cliente, y la contraseña se
// hashea antes de guardar. Los errores de email duplicado se traducen
// acá porque el service conoce el contexto del modelo.
export async function crear(datos: CrearAlumnoDto): Promise<AlumnoDoc> {
  const datosAGuardar = await conPasswordHasheada({ ...datos, clasesPorReservar: 0 });

  try {
    return await AlumnoModel.create(datosAGuardar);
  } catch (err) {
    throw verSiErrorClaveDuplicada(err, MENSAJE_EMAIL_DUPLICADO);
  }
}

// ============================================================
//  actualizar — modifica un alumno existente
// ============================================================
// "cambios" ya es un ActualizarAlumnoDto: trae solo los campos que el
// cliente quiere cambiar (el DTO rechazó los demás). Devuelve el
// alumno YA actualizado, o null si el id no existe. Si viene
// "password", se hashea igual que en crear.
export async function actualizar(
  id: string,
  cambios: ActualizarAlumnoDto,
): Promise<AlumnoDoc | null> {
  const cambiosAGuardar = await conPasswordHasheada(cambios);

  try {
    return await AlumnoModel.findByIdAndUpdate(id, cambiosAGuardar, {
      new: true, // devolver el documento actualizado, no el previo
      runValidators: true, // correr las validaciones del esquema también en el update
    });
  } catch (err) {
    throw verSiErrorClaveDuplicada(err, MENSAJE_EMAIL_DUPLICADO);
  }
}

export async function eliminar(id: string): Promise<AlumnoDoc | null> {
  return AlumnoModel.findByIdAndDelete(id);
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
  let alumnoActualizado: AlumnoDoc | null = null;

  if (alumno !== null) {
    alumno.clasesPorReservar += delta;
    alumnoActualizado = await alumno.save();
  }

  return alumnoActualizado;
}

// ============================================================
//  validarCantidad — helper interno de sumar/restar
// ============================================================
// Que "cantidad" sea un número ya lo garantiza el DTO (un texto como
// "2" lo rechaza aCantidadClasesDto). Acá se revisa la regla: tiene
// que ser un entero mayor que 0. 1.5 o NaN no sirven, y 0 tampoco:
// sumar o restar 0 clases no hace nada.
function validarCantidad(cantidad: number, operacion: 'sumar' | 'restar'): number {
  if (!Number.isInteger(cantidad)) {
    throw new ErrorDeNegocio(`La cantidad a ${operacion} debe ser un número entero`);
  }
  if (cantidad <= 0) {
    throw new ErrorDeNegocio(`La cantidad a ${operacion} debe ser mayor que 0`);
  }
  return cantidad;
}

// ============================================================
//  sumarClasesPorReservar — le suma N clases al saldo
// ============================================================
// "cantidad" es un delta a sumar (no el valor final): un entero
// mayor que 0 (ver validarCantidad).
export async function sumarClasesPorReservar(
  id: string,
  cantidad: number,
): Promise<AlumnoDoc | null> {
  return ajustarClasesPorReservar(id, validarCantidad(cantidad, 'sumar'));
}

// ============================================================
//  restarClasesPorReservar — le resta N clases al saldo
// ============================================================
// "cantidad" es un delta a restar (no el valor final): un entero
// mayor que 0 (ver validarCantidad). Si el saldo quedara por debajo
// de 0, el validador min:0 del esquema lo rechaza.
export async function restarClasesPorReservar(
  id: string,
  cantidad: number,
): Promise<AlumnoDoc | null> {
  return ajustarClasesPorReservar(id, -validarCantidad(cantidad, 'restar'));
}