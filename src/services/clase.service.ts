// ============================================================
//  clase.service.ts — Capa de servicio de Clases
// ============================================================

import { Types } from 'mongoose';
import { ClaseModel, type ClaseDoc, type Clase } from '../models/Clase.js';
import { AlumnoModel } from '../models/Alumno.js';
import { AutoModel } from '../models/Auto.js';
import { ProfesorModel } from '../models/Profesor.js';
import type { CalendarioSemanal } from '../models/CalendarioSemanal.js';
import { AdministradorModel } from '../models/Administrador.js';
import { HorarioEscuelaModel } from '../models/HorarioEscuela.js';
import { ErrorDeNegocio } from '../errors/errorDeNegocio.js';
import * as alumnoService from './alumno.service.js';
import { entraEnAlgunTramo } from './tramo.service.js';
import { aMinutos } from '../models/Horario.js';
import { aHoraLocal } from '../utils/fechas.js';
import type { ActualizarClaseDto, CrearClaseDto } from '../dtos/clase.dto.js';

// Toda clase dura exactamente una hora. Exportada para la consulta de
// turnos libres, que tiene que ofrecer clases que esta misma regla acepte.
export const DURACION_CLASE_MS = 60 * 60 * 1000;

export interface ActorClase {
  id: string;
  rol: 'alumno' | 'administrador';
}

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
  // Un admin accede a cualquier clase; un alumno, solo a las suyas.
  const puedeAccederla = clase !== null &&
    (actor.rol !== 'alumno' || clase.alumno.toString() === actor.id);
  return puedeAccederla ? clase : null;
}

// ============================================================
//  empiezaEnPunto — ¿el instante es una hora en punto en la escuela?
// ============================================================
// Se mira la hora de la ESCUELA (aHoraLocal) y no la de UTC: con un
// offset como +05:30, las 09:00 en la escuela son 03:30 en UTC.
export function empiezaEnPunto(instante: Date): boolean {
  const enPunto =
    aHoraLocal(instante).minuto === 0 &&
    instante.getUTCSeconds() === 0 &&
    instante.getUTCMilliseconds() === 0;
  return enPunto;
}

// Las fechas ya llegan como Date: el DTO las convirtió con
// parsearInstante (utils/fechas.ts). Acá solo se revisan las reglas.
// Con inicio en punto y una hora exacta, el fin también queda en punto.
function obtenerInstantes({
  inicio,
  fin,
}: Pick<Clase, 'inicio' | 'fin'>): Pick<Clase, 'inicio' | 'fin'> {
  exigir(
    fin.getTime() - inicio.getTime() === DURACION_CLASE_MS,
    'La duración de la clase debe ser exactamente una hora',
  );
  exigir(
    empiezaEnPunto(inicio),
    'La clase debe empezar en una hora en punto (por ejemplo, 08:00)',
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

  const intervalo = { inicio: aMinutos(inicioLocal), fin: aMinutos(finLocal) };

  exigir(
    entraEnAlgunTramo(calendarioEscuela[inicioLocal.dia], intervalo),
    'La clase queda fuera del horario de la escuela',
    409,
  );
  exigir(
    entraEnAlgunTramo(disponibilidadProfesor[inicioLocal.dia], intervalo),
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

// ============================================================
//  listarSuperpuestas — las clases que se pisan con un período
// ============================================================
// La misma búsqueda que validarAusenciaDeConflictos, pero devuelve las
// clases en vez de un sí o no. La usa la consulta de turnos libres para
// traer en una sola consulta todo lo que ocupa un día: las clases del
// profesor, las del alumno (si se indica) y las de esos autos.
export interface FiltroSuperpuestas {
  inicio: Date;
  fin: Date;
  profesor: string;
  alumno?: string;
  autos: readonly string[];
}

export async function listarSuperpuestas(
  filtro: FiltroSuperpuestas,
): Promise<ClaseDoc[]> {
  const deQuien: Record<string, unknown>[] = [
    { profesor: filtro.profesor },
    { auto: { $in: filtro.autos } },
  ];
  if (filtro.alumno !== undefined) {
    deQuien.push({ alumno: filtro.alumno });
  }

  const clases = await ClaseModel.find({
    inicio: { $lt: filtro.fin },
    fin: { $gt: filtro.inicio },
    $or: deQuien,
  });
  return clases;
}

function validarClaseModificable(clase: ClaseDoc): void {
  if (clase.inicio <= new Date()) {
    throw errorConflicto('No se puede modificar una clase que ya comenzó');
  }
}

// Completa el inicio o el fin que no se mandó, manteniendo la hora de
// duración. "cambios" ya trae las fechas como Date (o undefined).
function obtenerInstantesActualizados(
  clase: ClaseDoc,
  cambios: ActualizarClaseDto,
): Pick<Clase, 'inicio' | 'fin'> {
  const inicioSolicitado = cambios.inicio;
  const finSolicitado = cambios.fin;
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

// ============================================================
//  obtenerPorIdAlumno — de qué alumno es una clase (null si no existe)
// ============================================================
// Lo usa el middleware de las rutas GET, PUT y DELETE /clases/:id
// para dejar pasar solo al alumno de la clase o a un admin. Trae solo
// el campo "alumno". Si el id no tiene forma de ObjectId, Mongoose
// lanza un CastError (400).
export async function obtenerPorIdAlumno(id: string): Promise<string | null> {
  const clase = await ClaseModel.findById(id, { alumno: 1 });
  const idAlumno = clase === null ? null : clase.alumno.toString();
  return idAlumno;
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
    // El que reserva puede ser el alumno o un admin que reserva para él.
    const mensajeSinSaldo = actor.rol === 'alumno'
      ? 'No tenés clases disponibles para reservar'
      : 'El alumno no tiene clases disponibles para reservar';
    throw errorConflicto(mensajeSinSaldo);
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

// Aplica los cambios a una clase que el actor puede ver, después de
// validar que se pueda modificar y que el nuevo horario esté libre.
async function reprogramar(
  clase: ClaseDoc,
  cambios: ActualizarClaseDto,
): Promise<ClaseDoc> {
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
  const claseReprogramada = await clase.save();
  return claseReprogramada;
}

// "cambios" ya es un ActualizarClaseDto (ver dtos/clase.dto.ts).
export async function actualizar(
  id: string,
  cambios: ActualizarClaseDto,
  actor: ActorClase,
): Promise<ClaseDoc | null> {
  await validarActor(actor);
  const clase = await claseAccesible(id, actor);
  // Queda en null si la clase no existe o es de otro alumno.
  let claseActualizada: ClaseDoc | null = null;

  if (clase !== null) {
    claseActualizada = await reprogramar(clase, cambios);
  }

  return claseActualizada;
}

// ============================================================
//  eliminar — borra una clase y, si corresponde, devuelve el crédito
// ============================================================
// Un alumno solo puede borrar sus clases; un admin, cualquiera. Se
// pueden borrar también las que ya empezaron u ocurrieron, pero el
// crédito solo vuelve si la clase todavía no empezó: una clase que ya
// empezó se considera usada. Devuelve null si la clase no existe o es
// de otro alumno.
export async function eliminar(
  id: string,
  actor: ActorClase,
): Promise<ClaseDoc | null> {
  await validarActor(actor);
  const clase = await claseAccesible(id, actor);

  if (clase !== null) {
    const todaviaNoEmpezo = clase.inicio > new Date();

    await clase.deleteOne();

    if (todaviaNoEmpezo) {
      const idAlumno: string = clase.alumno.toString();
      await alumnoService.sumarClasesPorReservar(idAlumno, 1);
    }
  }

  return clase;
}
