// ============================================================
//  clase.service.ts — Capa de servicio de Clases
// ============================================================

import { Types } from 'mongoose';
import { ClaseModel, type ClaseDoc, type Clase } from '../models/Clase.js';
import { AlumnoModel } from '../models/Alumno.js';
import { AutoModel } from '../models/Auto.js';
import { ProfesorModel } from '../models/Profesor.js';
import type { CalendarioSemanal, Tramo } from '../models/CalendarioSemanal.js';
import { AdministradorModel } from '../models/Administrador.js';
import { HorarioEscuelaModel } from '../models/HorarioEscuela.js';
import { ErrorDeNegocio } from '../errors/errorDeNegocio.js';
import { aMinutos } from '../models/Horario.js';
import { aHoraLocal, parsearInstante } from '../utils/fechas.js';
import type { ActualizarClaseDto, CrearClaseDto } from '../dtos/clase.dto.js';

const DURACION_CLASE_MS = 60 * 60 * 1000;

export interface ActorClase {
  id: string;
  rol: 'alumno' | 'administrador';
}

export type DatosClase = Omit<
  Clase,
  'alumno' | 'profesor' | 'auto' | 'estado' | 'inicio' | 'fin'
> & {
  alumno?: string;
  profesor: string;
  auto: string;
  inicio: Date | string;
  fin: Date | string;
};

function errorConflicto(mensaje: string): ErrorDeNegocio {
  return new ErrorDeNegocio(mensaje, 409);
}

function exigir(
  condicion: unknown,
  mensaje: string,
  estado = 400,
): asserts condicion {
  if (!condicion) throw new ErrorDeNegocio(mensaje, estado);
}

function objectId(valor: string, campo: string): Types.ObjectId {
  exigir(Types.ObjectId.isValid(valor), `${campo} debe ser un identificador válido`);
  return new Types.ObjectId(valor);
}

async function validarActor(actor: ActorClase): Promise<void> {
  const existe =
    actor.rol === 'alumno'
      ? await AlumnoModel.exists({ _id: actor.id })
      : await AdministradorModel.exists({ _id: actor.id });

  exigir(existe !== null, 'La cuenta autenticada ya no está activa', 403);
}

async function claseAccesible(id: string, actor: ActorClase): Promise<ClaseDoc | null> {
  const clase = await ClaseModel.findById(id);
  return clase !== null &&
    (actor.rol !== 'alumno' || clase.alumno.toString() === actor.id)
    ? clase
    : null;
}

function obtenerInstantes(datos: Pick<DatosClase, 'inicio' | 'fin'>): {
  inicio: Date;
  fin: Date;
} {
  const inicio = parsearInstante(datos.inicio, 'inicio');
  const fin = parsearInstante(datos.fin, 'fin');
  exigir(inicio !== undefined && fin !== undefined, 'El inicio y el fin son obligatorios');
  exigir(
    fin.getTime() - inicio.getTime() === DURACION_CLASE_MS,
    'La duración de la clase debe ser exactamente una hora',
  );
  exigir(
    inicio.getUTCSeconds() === 0 &&
      inicio.getUTCMilliseconds() === 0 &&
      fin.getUTCSeconds() === 0 &&
      fin.getUTCMilliseconds() === 0,
    'El inicio y el fin deben tener precisión de minutos',
  );
  exigir(inicio > new Date(), 'La clase debe reservarse para una fecha futura');
  return { inicio, fin };
}

async function validarDisponibilidad(
  datos: Pick<Clase, 'alumno' | 'profesor' | 'auto' | 'inicio' | 'fin'>,
  excluirId?: string,
): Promise<void> {
  const [profesor, auto, horarioEscuela] = await Promise.all([
    ProfesorModel.findById(datos.profesor),
    AutoModel.findById(datos.auto),
    HorarioEscuelaModel.findById('escuela'),
  ]);

  exigir(profesor !== null, 'Profesor no encontrado', 404);
  exigir(auto !== null, 'Auto no encontrado', 404);
  exigir(auto.activo, 'El auto no está disponible para reservas', 409);
  exigir(horarioEscuela !== null, 'Todavía no se configuró el horario de la escuela', 409);

  validarHorarioClase(
    datos,
    horarioEscuela.calendario,
    profesor.disponibilidad,
  );
  await validarAusenciaDeConflictos(datos, excluirId);
}

function validarHorarioClase(
  datos: Pick<Clase, 'inicio' | 'fin'>,
  calendarioEscuela: CalendarioSemanal,
  disponibilidadProfesor: CalendarioSemanal,
): void {
  const inicioLocal = aHoraLocal(datos.inicio);
  const finLocal = aHoraLocal(datos.fin);
  exigir(inicioLocal.dia === finLocal.dia, 'La clase no puede cruzar el cambio de día');

  const inicioMinutos = aMinutos(inicioLocal);
  const finMinutos = aMinutos(finLocal);
  const entraEnHorario = (tramos: readonly Tramo[]) =>
    tramos.some(
      (tramo) =>
        aMinutos(tramo.horaInicio) <= inicioMinutos &&
        finMinutos <= aMinutos(tramo.horaFin),
    );

  exigir(
    entraEnHorario(calendarioEscuela[inicioLocal.dia]),
    'La clase queda fuera del horario de la escuela',
    409,
  );
  exigir(
    entraEnHorario(disponibilidadProfesor[inicioLocal.dia]),
    'El profesor no está disponible en ese horario',
    409,
  );
}

async function validarAusenciaDeConflictos(
  datos: Pick<Clase, 'alumno' | 'profesor' | 'auto' | 'inicio' | 'fin'>,
  excluirId?: string,
): Promise<void> {
  const conflicto = await ClaseModel.exists({
    ...(excluirId === undefined ? {} : { _id: { $ne: excluirId } }),
    estado: { $ne: 'cancelada' },
    inicio: { $lt: datos.fin },
    fin: { $gt: datos.inicio },
    $or: [
      { alumno: datos.alumno },
      { profesor: datos.profesor },
      { auto: datos.auto },
    ],
  });
  exigir(
    conflicto === null,
    'El alumno, profesor o auto ya tiene una clase en ese horario',
    409,
  );
}

function validarClaseModificable(clase: ClaseDoc): void {
  if (clase.estado === 'cancelada') {
    throw errorConflicto('No se puede modificar una clase cancelada');
  }
  if (clase.inicio <= new Date()) {
    throw errorConflicto('No se puede modificar una clase que ya comenzó');
  }
}

function obtenerInstantesActualizados(
  clase: ClaseDoc,
  cambios: Partial<DatosClase>,
): { inicio: Date; fin: Date } {
  const inicioSolicitado = cambios.inicio === undefined
    ? undefined
    : parsearInstante(cambios.inicio, 'inicio');
  const finSolicitado = cambios.fin === undefined
    ? undefined
    : parsearInstante(cambios.fin, 'fin');
  const inicio = inicioSolicitado ??
    (finSolicitado === undefined
      ? clase.inicio
      : new Date(finSolicitado.getTime() - DURACION_CLASE_MS));
  const fin = finSolicitado ??
    (inicioSolicitado === undefined
      ? clase.fin
      : new Date(inicioSolicitado.getTime() + DURACION_CLASE_MS));

  return obtenerInstantes({ inicio, fin });
}

export async function listar(actor: ActorClase): Promise<ClaseDoc[]> {
  await validarActor(actor);
  return ClaseModel.find(
    actor.rol === 'administrador' ? {} : { alumno: actor.id },
  ).sort({ inicio: 1 });
}

export async function obtenerPorId(
  id: string,
  actor: ActorClase,
): Promise<ClaseDoc | null> {
  await validarActor(actor);
  return claseAccesible(id, actor);
}

// "datos" ya es un CrearClaseDto: qué campos puede mandar cada rol y
// de qué tipo los validó el controller (ver dtos/clase.dto.ts). Acá se
// aplican las reglas de la reserva.
export async function crear(
  datos: CrearClaseDto,
  actor: ActorClase,
): Promise<ClaseDoc> {
  await validarActor(actor);

  // Un alumno reserva para sí mismo; un admin, para el alumno que indicó.
  const idAlumno = actor.rol === 'alumno' ? actor.id : datos.alumno;
  exigir(idAlumno !== undefined, 'El alumno es obligatorio');

  const instantes = obtenerInstantes(datos);
  const alumnoId = objectId(idAlumno, 'alumno');
  const profesorId = objectId(datos.profesor, 'profesor');
  const autoId = objectId(datos.auto, 'auto');
  const datosClase = {
    alumno: alumnoId,
    profesor: profesorId,
    auto: autoId,
    ...instantes,
  };
  await validarDisponibilidad(datosClase);

  const alumno = await AlumnoModel.findOneAndUpdate(
    { _id: alumnoId, clasesPorReservar: { $gte: 1 } },
    { $inc: { clasesPorReservar: -1 } },
    { returnDocument: 'after', runValidators: true },
  );
  if (alumno === null) {
    const existeAlumno = await AlumnoModel.exists({ _id: alumnoId });
    if (existeAlumno === null) throw new ErrorDeNegocio('Alumno no encontrado', 404);
    throw errorConflicto('No tenés clases disponibles para reservar');
  }

  try {
    return await ClaseModel.create(datosClase);
  } catch (error) {
    const restaurado = await AlumnoModel.updateOne(
      { _id: alumnoId },
      { $inc: { clasesPorReservar: 1 } },
    );
    if (restaurado.matchedCount !== 1) {
      throw new AggregateError(
        [error],
        'Falló la creación de la clase y no se pudo restaurar el saldo del alumno',
      );
    }
    throw error;
  }
}

// "cambios" ya es un ActualizarClaseDto (ver dtos/clase.dto.ts).
export async function actualizar(
  id: string,
  cambios: ActualizarClaseDto,
  actor: ActorClase,
): Promise<ClaseDoc | null> {
  await validarActor(actor);
  const clase = await claseAccesible(id, actor);
  if (clase === null) return null;
  validarClaseModificable(clase);
  const instantes = obtenerInstantesActualizados(clase, cambios);
  const profesor = cambios.profesor === undefined
    ? clase.profesor
    : objectId(cambios.profesor, 'profesor');
  const auto = cambios.auto === undefined
    ? clase.auto
    : objectId(cambios.auto, 'auto');
  await validarDisponibilidad(
    { alumno: clase.alumno, profesor, auto, ...instantes },
    clase._id.toString(),
  );

  clase.profesor = profesor;
  clase.auto = auto;
  clase.inicio = instantes.inicio;
  clase.fin = instantes.fin;
  return clase.save();
}

export async function cancelar(
  id: string,
  actor: ActorClase,
): Promise<ClaseDoc | null> {
  await validarActor(actor);
  const clase = await claseAccesible(id, actor);
  if (clase === null) return null;
  if (clase.estado === 'cancelada') return clase;
  if (clase.inicio <= new Date()) {
    throw errorConflicto('Solo se pueden cancelar clases futuras');
  }

  const cancelada = await ClaseModel.findOneAndUpdate(
    { _id: id, estado: { $ne: 'cancelada' }, inicio: { $gt: new Date() } },
    { $set: { estado: 'cancelada' } },
    { returnDocument: 'after', runValidators: true },
  );
  if (cancelada === null) {
    throw errorConflicto('La clase cambió mientras se intentaba cancelar');
  }

  try {
    await AlumnoModel.updateOne(
      { _id: cancelada.alumno },
      { $inc: { clasesPorReservar: 1 } },
    );
  } catch (error) {
    const restaurada = await ClaseModel.updateOne(
      { _id: cancelada._id, estado: 'cancelada' },
      { $set: { estado: clase.estado } },
    );
    if (restaurada.matchedCount !== 1) {
      throw new AggregateError(
        [error],
        'Falló el reintegro del crédito y no se pudo restaurar el estado de la clase',
      );
    }
    throw error;
  }
  return cancelada;
}
