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
import { DESCRIPCION_TIPO, esDelTipo } from '../utils/validacionTipos.js';


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

const CAMPOS_ACTUALIZABLES = {
  email: { tipo: 'string', nombre: 'El email' },
  password: { tipo: 'string', nombre: 'La contraseña' },
  nomApe: { tipo: 'string', nombre: 'El nombre y apellido' },
} as const;

// 'email' | 'password' | 'nomApe', derivado de las claves de arriba.
type CampoActualizable = keyof typeof CAMPOS_ACTUALIZABLES;

// Type guard: ¿"campo" es una de las claves de CAMPOS_ACTUALIZABLES?
// Usa Object.hasOwn y no "campo in ...": "in" también mira las
// propiedades heredadas, y aceptaría campos como "toString".
function esCampoActualizable(campo: string): campo is CampoActualizable {
  return Object.hasOwn(CAMPOS_ACTUALIZABLES, campo);
}

// ============================================================
//  validarCambios — helper interno de actualizar
// ============================================================
// "cambios" es el objeto que mandó el cliente (el controller ya
// comprobó que es un objeto), con campos sin revisar.
// Devuelve un Partial<Alumno> armado solo con los campos validados.
function validarCambios(cambios: Record<string, unknown>): Partial<Alumno> {
  // Una sola pasada por las claves: cada una va a permitidos o a no
  // permitidos. Como esCampoActualizable es un type guard, dentro del
  // if "campo" ya es CampoActualizable y se puede guardar en
  // camposPermitidos.
  const camposPermitidos: CampoActualizable[] = [];
  const camposNoPermitidos: string[] = [];
  for (const campo of Object.keys(cambios)) {
    if (esCampoActualizable(campo)) {
      camposPermitidos.push(campo);
    } else {
      camposNoPermitidos.push(campo);
    }
  }

  if (camposNoPermitidos.length > 0) {
    const ayuda = camposNoPermitidos.includes('clasesPorReservar')
      ? ' (el saldo de clases se cambia con sumar-clases / restar-clases)'
      : '';
    throw new ErrorDeNegocio(
      `No se pueden modificar estos campos: ${camposNoPermitidos.join(', ')}${ayuda}`,
    );
  }

  if (camposPermitidos.length === 0) {
    throw new ErrorDeNegocio('Debe indicarse al menos un campo para actualizar');
  }

  const validados: Partial<Alumno> = {};

  for (const campo of camposPermitidos) {
    const { tipo, nombre } = CAMPOS_ACTUALIZABLES[campo];
    const valor = cambios[campo];

    if (!esDelTipo(valor, tipo)) {
      throw new ErrorDeNegocio(`${nombre} debe ser ${DESCRIPCION_TIPO[tipo]}`);
    }

    validados[campo] = valor;
  }

  return validados;
}

// ============================================================
//  actualizar — modifica un alumno existente
// ============================================================
// "cambios" es el objeto que mandó el cliente, con solo los campos
// que quiere cambiar; se valida con validarCambios antes de tocar
// la base. Devuelve el alumno YA actualizado, o null si el id no
// existe. Si viene "password", se hashea igual que en crear.
export async function actualizar(
  id: string,
  cambios: Record<string, unknown>,
): Promise<AlumnoDoc | null> {
  const cambiosAGuardar = await conPasswordHasheada(validarCambios(cambios));

  try {
    return await AlumnoModel.findByIdAndUpdate(id, cambiosAGuardar, {
      new: true, // devolver el documento actualizado, no el previo
      runValidators: true, // correr las validaciones del esquema también en el update
    });
  } catch (err) {
    throw comoErrorClaveDuplicada(err, MENSAJE_EMAIL_DUPLICADO);
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
  if (alumno === null) return null;

  alumno.clasesPorReservar += delta;

  return alumno.save();
}

// ============================================================
//  validarCantidad — helper interno de sumar/restar
// ============================================================
// "cantidad" llega tal como la mandó el cliente (unknown). Tiene
// que ser un número entero mayor que 0:
//   - un texto como "2" se rechaza (en JSON los números van sin
//     comillas), igual que 1.5, NaN o undefined (si no vino);
//   - 0 se rechaza: sumar o restar 0 clases no hace nada.
// Devuelve la cantidad ya tipada como number.
function validarCantidad(cantidad: unknown, operacion: 'sumar' | 'restar'): number {
  if (typeof cantidad !== 'number' || !Number.isInteger(cantidad)) {
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
  cantidad: unknown,
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
  cantidad: unknown,
): Promise<AlumnoDoc | null> {
  return ajustarClasesPorReservar(id, -validarCantidad(cantidad, 'restar'));
}