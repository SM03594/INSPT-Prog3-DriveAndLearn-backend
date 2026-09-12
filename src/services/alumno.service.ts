// ============================================================
//  alumno.service.ts — Capa de servicio de Alumnos
// ============================================================

import bcrypt from 'bcrypt';
import {
  AlumnoModel,
  type Alumno,
  type AlumnoDoc,
} from '../models/Alumno.js';

// Cantidad de rondas de sal que usa bcrypt para hashear.
const BCRYPT_ROUNDS = 10;

type AlumnoConSaldo = AlumnoDoc & {
  clasesPorReservar: number;
};

async function prepararDatosAlumno(
  datos: Alumno | Partial<Alumno>,
): Promise<Alumno | Partial<Alumno>> {
  if (typeof datos.password !== 'string') {
    return datos;
  }

  return {
    ...datos,
    password: await bcrypt.hash(datos.password, BCRYPT_ROUNDS),
  };
}

function crearErrorDeCantidad(mensaje: string): Error {
  return new Error(mensaje);
}

function esErrorDeClaveDuplicada(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}

function validarCantidad(cantidad: unknown, operacion: 'sumar' | 'restar'): asserts cantidad is number {
  if (typeof cantidad !== 'number' || !Number.isInteger(cantidad) || cantidad < 0) {
    throw crearErrorDeCantidad(
      `La cantidad a ${operacion} debe ser un número entero mayor o igual a 0.`,
    );
  }
}

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
// Antes de guardar hasheamos la contraseña: en la base nunca
// queda el texto plano. Si "password" no vino, NO llamamos a
// bcrypt: dejamos que sea el validador "required" del esquema
// el que rechace la creación con un ValidationError.
export async function crear(datos: Alumno): Promise<AlumnoDoc> {
  const datosAGuardar = await prepararDatosAlumno(datos);

  try {
    return await AlumnoModel.create(datosAGuardar);
  } catch (error) {
    if (esErrorDeClaveDuplicada(error)) {
      throw new Error('Ya existe un alumno con esos datos.');
    }

    throw error;
  }
}

// ============================================================
//  actualizar — modifica un alumno existente
// ============================================================
// "cambios" trae solo los campos que el cliente quiere cambiar,
// por eso es Partial<DatosAlumno>. Devuelve el alumno YA
// actualizado, o null si el id no existe.
export async function actualizar(
  id: string,
  cambios: Partial<Alumno>,
): Promise<AlumnoDoc | null> {
  const datosActualizados = await prepararDatosAlumno(cambios);

  try {
    return await AlumnoModel.findByIdAndUpdate(id, datosActualizados, {
      returnDocument: 'after',
      runValidators: true,
    });
  } catch (error) {
    if (esErrorDeClaveDuplicada(error)) {
      throw new Error('Ya existe un alumno con esos datos.');
    }

    throw error;
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
  const alumno = (await AlumnoModel.findById(id)) as AlumnoConSaldo | null;
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
  validarCantidad(cantidad, 'sumar');
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
  validarCantidad(cantidad, 'restar');
  return ajustarClasesPorReservar(id, -cantidad);
}
