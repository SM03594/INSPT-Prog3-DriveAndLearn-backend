// ============================================================
//  profesor.service.ts — Capa de servicio de Profesores
// ============================================================

import {
  ProfesorModel,
  type ProfesorDoc,
} from '../models/Profesor.js';
import type { Tramo } from '../models/Tramo.js';
import { ErrorDeNegocio } from '../errors/errorDeNegocio.js';
import { agregarTramo, quitarTramo, validarDia } from './calendarioSemanal.service.js';
import type { CrearProfesorDto } from '../dtos/profesor.dto.js';

// La forma de lo que manda el cliente la valida el DTO en el
// controller (ver dtos/profesor.dto.ts): acá llegan valores con el
// tipo correcto, y se aplican las reglas.

// Regla: el nombre no puede quedar vacío ("   " tampoco sirve).
function nombreObligatorio(nomApe: string): string {
  if (nomApe.trim() === '') {
    throw new ErrorDeNegocio('El nombre y apellido del profesor es obligatorio');
  }
  return nomApe;
}

// ============================================================
//  listar — todos los profesores
// ============================================================
export async function listar(): Promise<ProfesorDoc[]> {
  return ProfesorModel.find();
}

// ============================================================
//  crear — crear un profesor
// ============================================================
export async function crear(datos: CrearProfesorDto): Promise<ProfesorDoc> {
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
  nomApe: string,
): Promise<ProfesorDoc | null> {
  return ProfesorModel.findByIdAndUpdate(
    id,
    { nomApe: nombreObligatorio(nomApe) },
    { new: true, runValidators: true },
  );
}

// ============================================================
//  agregarDisponibilidad — suma un tramo al día indicado
// ============================================================
export async function agregarDisponibilidad(
  id: string,
  dia: string,
  tramo: Tramo,
): Promise<ProfesorDoc | null> {
  const profesor = await ProfesorModel.findById(id);
  let profesorActualizado: ProfesorDoc | null = null;

  if (profesor !== null) {
    validarDia(dia);
    agregarTramo(profesor.disponibilidad, dia, tramo);
    profesorActualizado = await profesor.save();
  }

  return profesorActualizado;
}

// ============================================================
//  quitarDisponibilidad — elimina el tramo con ese _id
// ============================================================
export async function quitarDisponibilidad(
  id: string,
  dia: string,
  tramoId: string,
): Promise<ProfesorDoc | null> {
  const profesor = await ProfesorModel.findById(id);
  
  let profesorActualizado: ProfesorDoc | null = null;

  if (profesor !== null) {
    validarDia(dia);
    const seQuitoElTramo = quitarTramo(profesor.disponibilidad, dia, tramoId);

    if (seQuitoElTramo) {
      profesorActualizado = await profesor.save();
    }
  }

  return profesorActualizado;
}
