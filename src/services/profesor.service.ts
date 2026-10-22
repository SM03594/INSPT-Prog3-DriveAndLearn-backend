// ============================================================
//  profesor.service.ts — Capa de servicio de Profesores
// ============================================================

import {
  ProfesorModel,
  type ProfesorDoc,
} from '../models/Profesor.js';
import type { Tramo, Dia } from '../models/CalendarioSemanal.js';
import { ErrorDeNegocio } from '../errors/errorDeNegocio.js';
import { agregarTramo, quitarTramo, validarDia } from './calendarioSemanal.service.js';

const CAMPOS_CREACION = ['nomApe'];

function exigir(condicion: unknown, mensaje: string): asserts condicion {
  if (!condicion) throw new ErrorDeNegocio(mensaje);
}

function validarObjeto(valor: unknown, nombre: string): Record<string, unknown> {
  exigir(
    typeof valor === 'object' && valor !== null && !Array.isArray(valor),
    `${nombre} debe ser un objeto`,
  );
  return valor as Record<string, unknown>;
}

function rechazarCamposNoPermitidos(
  datos: Record<string, unknown>,
  permitidos: readonly string[],
): void {
  const noPermitidos = Object.keys(datos).filter((campo) => !permitidos.includes(campo));
  exigir(
    noPermitidos.length === 0,
    `Campos no permitidos: ${noPermitidos.join(', ')}`,
  );
}

function nombreObligatorio(valor: unknown): string {
  exigir(
    typeof valor === 'string' && valor.trim() !== '',
    'El nombre y apellido del profesor es obligatorio',
  );
  return valor;
}

function diaObligatorio(valor: unknown): Dia {
  exigir(typeof valor === 'string', 'El día debe ser un texto');
  validarDia(valor);
  return valor;
}

function tramoComoDatos(valor: unknown): Tramo {
  validarObjeto(valor, 'El tramo');
  return valor as Tramo;
}

function esBufferSerializado(
  valor: unknown,
): valor is { type: 'Buffer'; data: number[] } {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    return false;
  }
  const objeto = valor as Record<string, unknown>;
  return objeto.type === 'Buffer' && Array.isArray(objeto.data) &&
    objeto.data.every((byte) =>
      typeof byte === 'number' && Number.isInteger(byte) && byte >= 0 && byte <= 255,
    );
}

function fotoComoBuffer(valor: unknown): Buffer {
  if (valor === undefined || valor === null) return Buffer.alloc(0);
  if (Buffer.isBuffer(valor)) return valor;
  if (typeof valor === 'string') return Buffer.from(valor, 'base64');
  if (
    Array.isArray(valor) &&
    valor.every((byte) =>
      typeof byte === 'number' && Number.isInteger(byte) && byte >= 0 && byte <= 255,
    )
  ) {
    return Buffer.from(valor);
  }
  if (esBufferSerializado(valor)) return Buffer.from(valor.data);
  throw new ErrorDeNegocio('La foto debe enviarse en base64 o como bytes');
}

// ============================================================
//  listar — todos los profesores
// ============================================================
export async function listar(): Promise<ProfesorDoc[]> {
  return ProfesorModel.find();
}

export async function crear(datosEntrada: unknown): Promise<ProfesorDoc> {
  const datos = validarObjeto(datosEntrada, 'El cuerpo de la petición');
  rechazarCamposNoPermitidos(datos, CAMPOS_CREACION);
  return ProfesorModel.create({ nomApe: nombreObligatorio(datos.nomApe) });
}

// ============================================================
//  obtenerPorId — un profesor por su _id (null si no existe)
// ============================================================
// Si el id no tiene forma de ObjectId, Mongoose lanza un
// CastError (el controller lo traduce a 400).
export async function obtenerPorId(id: string): Promise<ProfesorDoc | null> {
  return ProfesorModel.findById(id);
}

// ============================================================
//  cambiarNomApe — actualiza el nombre y apellido
// ============================================================
export async function cambiarNomApe(
  id: string,
  nomApe: unknown,
): Promise<ProfesorDoc | null> {
  return ProfesorModel.findByIdAndUpdate(
    id,
    { nomApe },
    { new: true, runValidators: true },
  );
}

// ============================================================
//  cambiarFotoPerfil — reemplaza la foto de perfil
// ============================================================
export async function cambiarFotoPerfil(
  id: string,
  fotoEntrada: unknown,
): Promise<ProfesorDoc | null> {
  const profesor = await ProfesorModel.findById(id);
  if (profesor === null) return null;

  profesor.fotoPerfil = fotoComoBuffer(fotoEntrada);
  return profesor.save();
}

// ============================================================
//  agregarDisponibilidad — suma un tramo al día indicado
// ============================================================
export async function agregarDisponibilidad(
  id: string,
  diaEntrada: unknown,
  tramoEntrada: unknown,
): Promise<ProfesorDoc | null> {
  const profesor = await ProfesorModel.findById(id);
  if (profesor === null) return null;

  const dia = diaObligatorio(diaEntrada);
  const tramo = tramoComoDatos(tramoEntrada);
  agregarTramo(profesor.disponibilidad, dia, tramo);
  return profesor.save();
}

// ============================================================
//  quitarDisponibilidad — elimina el tramo con ese _id
// ============================================================
export async function quitarDisponibilidad(
  id: string,
  diaEntrada: unknown,
  tramoIdEntrada: unknown,
): Promise<ProfesorDoc | null> {
  const profesor = await ProfesorModel.findById(id);
  if (profesor === null) return null;

  const dia = diaObligatorio(diaEntrada);
  exigir(typeof tramoIdEntrada === 'string', 'El identificador del tramo debe ser un texto');
  const tramoId = tramoIdEntrada;
  const quitado = quitarTramo(profesor.disponibilidad, dia, tramoId);
  if (!quitado) return null;

  return profesor.save();
}
