// ============================================================
//  auto.service.ts — Capa de servicio de Autos
// ============================================================

import {
  AutoModel,
  type AutoDoc,
  type Cambios,
} from '../models/Auto.js';
import {
  ErrorClaveDuplicada,
  verSiErrorClaveDuplicada,
} from '../errors/errorClaveDuplicada.js';
import type { ActualizarAutoDto, CrearAutoDto } from '../dtos/auto.dto.js';

// Mensaje de la patente repetida cuando la encuentra el service, y de
// respaldo si el Schema no definió uno propio (ver verSiErrorClaveDuplicada).
const MENSAJE_PATENTE_DUPLICADA = 'La patente ya está en uso';

// ============================================================
//  verificarPatenteLibre — que ningún OTRO auto tenga esa patente
// ============================================================
// No hace falta pasar la patente a mayúsculas ni recortarla: Mongoose
// aplica el uppercase y el trim del esquema también al filtro, así que
// "  ab123cd " encuentra a "AB123CD".
// "idPropio" es el auto que se está editando: si la patente es la suya,
// no cuenta como repetida.
//
// El índice unique de la patente sigue siendo la última barrera: si dos
// pedidos con la misma patente llegan a la vez, los dos pasan esta
// consulta y el índice frena al segundo. Pero no alcanza solo con el
// índice: si no se pudo crear (por ejemplo, porque la colección ya tenía
// patentes repetidas), Mongoose no avisa y los duplicados entran igual.
async function verificarPatenteLibre(patente: string, idPropio?: string): Promise<void> {
  const filtro =
    idPropio === undefined ? { patente } : { patente, _id: { $ne: idPropio } };
  const otroAutoConEsaPatente = await AutoModel.exists(filtro);

  if (otroAutoConEsaPatente !== null) {
    throw new ErrorClaveDuplicada(MENSAJE_PATENTE_DUPLICADA);
  }
}


export async function listar(): Promise<AutoDoc[]> {
  return AutoModel.find();
}


export async function obtenerPorId(id: string): Promise<AutoDoc | null> {
  return AutoModel.findById(id);
}

// ============================================================
//  listarActivos — los autos que se pueden reservar
// ============================================================
// Solo los que están en servicio, de un tipo de cambios o de los dos.
// Trae solo lo que se le muestra al alumno para elegir, ordenado por
// patente para que la lista salga siempre en el mismo orden.
export async function listarActivos(cambios?: Cambios): Promise<AutoDoc[]> {
  const filtro = cambios === undefined ? { activo: true } : { activo: true, cambios };
  const autos = await AutoModel.find(filtro, {
    marca: 1,
    modelo: 1,
    patente: 1,
    cambios: 1,
  }).sort({ patente: 1 });
  return autos;
}


// "datos" ya es un CrearAutoDto: la forma la validó el controller (ver
// dtos/auto.dto.ts). Primero se busca si la patente ya está en uso.
// Aun así, create() puede chocar contra el índice unique de patente
// (dos altas a la vez): se atrapa el error crudo de Mongo/Mongoose acá,
// no en el middleware, porque acá es donde se sabe qué campo es y qué
// mensaje tiene sentido para Auto.
export async function crear(datos: CrearAutoDto): Promise<AutoDoc> {
  await verificarPatenteLibre(datos.patente);

  try {
    return await AutoModel.create(datos);
  } catch (err) {
    throw verSiErrorClaveDuplicada(err, MENSAJE_PATENTE_DUPLICADA);
  }
}

// ============================================================
//  actualizar — modifica un auto existente
// ============================================================
// "cambios" ya es un ActualizarAutoDto: solo los datos del auto que el
// cliente quiere cambiar (sin "activo" ni operadores como $set).
// Devuelve el auto YA actualizado, o null si el id no existe.
export async function actualizar(
  id: string,
  cambios: ActualizarAutoDto,
): Promise<AutoDoc | null> {
  if (cambios.patente !== undefined) {
    await verificarPatenteLibre(cambios.patente, id);
  }

  try {
    return await AutoModel.findByIdAndUpdate(id, cambios, {
      new: true, // devolver el documento actualizado, no el previo
      runValidators: true, // correr las validaciones del esquema también en el update
    });
  } catch (err) {
    // findByIdAndUpdate también puede chocar contra el índice unique
    // si "cambios.patente" coincide con la de otro auto.
    throw verSiErrorClaveDuplicada(err, MENSAJE_PATENTE_DUPLICADA);
  }
}

// ============================================================
//  cambiarEstado — pone o saca un auto de servicio
// ============================================================
// "estadoNuevo" ya es un booleano: lo garantiza aCambiarActivoDto.
export async function cambiarEstado(
  id: string,
  estadoNuevo: boolean,
): Promise<AutoDoc | null> {
  return AutoModel.findByIdAndUpdate(
    id,
    { activo: estadoNuevo },
    { new: true, runValidators: true }, //devolcer el documento acutalizado
  );
}
