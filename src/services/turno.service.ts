// ============================================================
//  turno.service.ts — Consultar los turnos libres de un profesor
// ============================================================
// Para un día, devuelve los turnos de una hora en los que se puede
// reservar una clase con ese profesor, cada uno con los autos libres.
// Nada se guarda ni se bloquea: es una foto del momento.
//
// Solo usa otros services (nunca models ajenos), y las mismas reglas
// que la reserva: la duración (DURACION_CLASE_MS), clases en punto, y
// una clase entera dentro de un tramo de la escuela y de uno del
// profesor (los cálculos de tramo.service). Así cualquier turno
// devuelto se puede mandar tal cual a POST /clases.
//
// Cómo se arman los turnos (en minutos desde medianoche, hora de la
// escuela):
//   1) ventanas: cada tramo del profesor ese día, cruzado con cada
//      tramo de la escuela y con desde/hasta. Los tramos NO se unen:
//      una clase tiene que entrar entera en un tramo.
//   2) cada ventana se parte en clases de una hora, desde su primera
//      hora en punto.
//   3) se pasan a instantes y se sacan los que ya empezaron.
//   4) se sacan los turnos en los que el profesor (o el alumno que
//      consulta) ya tiene clase, y a cada uno se le dejan los autos
//      libres. Un turno sin autos libres no se muestra.

import type { AlumnoDoc } from '../models/Alumno.js';
import type { AutoDoc } from '../models/Auto.js';
import type { Dia } from '../models/CalendarioSemanal.js';
import type { ClaseDoc } from '../models/Clase.js';
import { aMinutos } from '../models/Horario.js';
import type { Tramo } from '../models/Tramo.js';
import { ErrorDeNegocio } from '../errors/errorDeNegocio.js';
import * as administradorService from './administrador.service.js';
import * as alumnoService from './alumno.service.js';
import * as autoService from './auto.service.js';
import * as claseService from './clase.service.js';
import { DURACION_CLASE_MS, type ActorClase } from './clase.service.js';
import * as horarioEscuelaService from './horarioEscuela.service.js';
import * as profesorService from './profesor.service.js';
import {
  aIntervalo,
  cruzarIntervalos,
  type IntervaloMinutos,
} from './tramo.service.js';
import {
  compararFechas,
  diaDeLaSemana,
  formatearFecha,
  hoyEnLaEscuela,
  instanteLocal,
  type FechaCalendario,
} from '../utils/fechas.js';
import type { ConsultarTurnosDto } from '../dtos/turno.dto.js';

const MINUTOS_POR_HORA = 60;
const MINUTOS_DEL_DIA = 24 * MINUTOS_POR_HORA;
const MINUTOS_POR_CLASE = DURACION_CLASE_MS / (60 * 1000);

export interface TurnoLibre {
  inicio: Date;
  fin: Date;
  autos: AutoDoc[];
}

export interface TurnosLibres {
  fecha: string; // "AAAA-MM-DD"
  dia: Dia;
  turnos: TurnoLibre[];
}

// Un turno todavía sin autos: el inicio y el fin de una clase posible.
interface Turno {
  inicio: Date;
  fin: Date;
}

// ============================================================
//  Reglas del pedido
// ============================================================
function exigirFechaNoPasada(fecha: FechaCalendario): void {
  const esPasada = compararFechas(fecha, hoyEnLaEscuela()) < 0;

  if (esPasada) {
    throw new ErrorDeNegocio('La fecha debe ser hoy o posterior');
  }
}

// Devuelve el alumno que consulta (para su saldo y sus clases), o null
// si consulta un admin.
async function cuentaQueConsulta(actor: ActorClase): Promise<AlumnoDoc | null> {
  let alumno: AlumnoDoc | null = null;
  let cuentaActiva: boolean;

  if (actor.rol === 'alumno') {
    alumno = await alumnoService.obtenerPorId(actor.id);
    cuentaActiva = alumno !== null;
  } else {
    cuentaActiva = await administradorService.existe(actor.id);
  }

  if (!cuentaActiva) {
    throw new ErrorDeNegocio('La cuenta autenticada ya no está activa', 403);
  }

  return alumno;
}

// Un alumno sin saldo no podría reservar ninguno de los turnos. El
// admin no indica alumno: el saldo se revisa recién al reservar.
function exigirSaldo(alumno: AlumnoDoc | null): void {
  const sinSaldo = alumno !== null && alumno.clasesPorReservar < 1;

  if (sinSaldo) {
    throw new ErrorDeNegocio('No tenés clases disponibles para reservar', 409);
  }
}

// ============================================================
//  1) Ventanas: profesor ∩ escuela ∩ desde/hasta
// ============================================================
function rangoPedido(consulta: ConsultarTurnosDto): IntervaloMinutos {
  const rango = {
    inicio: consulta.desde === undefined ? 0 : aMinutos(consulta.desde),
    fin: consulta.hasta === undefined ? MINUTOS_DEL_DIA : aMinutos(consulta.hasta),
  };
  return rango;
}

function ventanasDelDia(
  tramosProfesor: readonly Tramo[],
  tramosEscuela: readonly Tramo[],
  rango: IntervaloMinutos,
): IntervaloMinutos[] {
  const ventanas: IntervaloMinutos[] = [];

  for (const tramoProfesor of tramosProfesor) {
    for (const tramoEscuela of tramosEscuela) {
      const conLaEscuela = cruzarIntervalos(aIntervalo(tramoProfesor), aIntervalo(tramoEscuela));
      const ventana = conLaEscuela === null ? null : cruzarIntervalos(conLaEscuela, rango);

      if (ventana !== null) {
        ventanas.push(ventana);
      }
    }
  }

  return ventanas;
}

// ============================================================
//  2) Partir cada ventana en clases de una hora, en punto
// ============================================================
// ventana 09:30–12:00 → 10, 11 (09:30 no es en punto).
function iniciosEnPunto(ventana: IntervaloMinutos): number[] {
  const inicios: number[] = [];
  const primeraHoraEnPunto = Math.ceil(ventana.inicio / MINUTOS_POR_HORA) * MINUTOS_POR_HORA;

  for (
    let inicio = primeraHoraEnPunto;
    inicio + MINUTOS_POR_CLASE <= ventana.fin;
    inicio += MINUTOS_POR_HORA
  ) {
    inicios.push(inicio);
  }

  return inicios;
}

// ============================================================
//  3) De minutos a instantes, sin repetidos y sin los ya empezados
// ============================================================
// Dos tramos superpuestos del profesor pueden dar el mismo turno: se
// deja uno. La condición "inicio > ahora" es la misma de la reserva.
function turnosDelDia(
  fecha: FechaCalendario,
  ventanas: readonly IntervaloMinutos[],
): Turno[] {
  const iniciosSinRepetir = [...new Set(ventanas.flatMap(iniciosEnPunto))].sort((a, b) => a - b);
  const ahora = new Date();

  const turnos = iniciosSinRepetir
    .map((minutos) => {
      const inicio = instanteLocal(fecha, { hora: minutos / MINUTOS_POR_HORA, minuto: 0 });
      return { inicio, fin: new Date(inicio.getTime() + DURACION_CLASE_MS) };
    })
    .filter((turno) => turno.inicio > ahora);

  return turnos;
}

// ============================================================
//  4) Las clases que ocupan esos turnos, y los autos libres
// ============================================================
// Una sola consulta, del primer turno al último. Sin turnos o sin
// autos no hay nada que buscar.
async function clasesQuePisan(
  turnos: readonly Turno[],
  idProfesor: string,
  idAlumno: string | undefined,
  autos: readonly AutoDoc[],
): Promise<ClaseDoc[]> {
  let clases: ClaseDoc[] = [];
  const hayQueBuscar = turnos.length > 0 && autos.length > 0;

  if (hayQueBuscar) {
    clases = await claseService.listarSuperpuestas({
      inicio: turnos[0].inicio,
      fin: turnos[turnos.length - 1].fin,
      profesor: idProfesor,
      alumno: idAlumno,
      autos: autos.map((auto) => auto._id.toString()),
    });
  }

  return clases;
}

function sePisan(clase: ClaseDoc, turno: Turno): boolean {
  const pisa = clase.inicio < turno.fin && clase.fin > turno.inicio;
  return pisa;
}

function conAutosLibres(
  turnos: readonly Turno[],
  clases: readonly ClaseDoc[],
  autos: readonly AutoDoc[],
  idProfesor: string,
  idAlumno: string | undefined,
): TurnoLibre[] {
  const turnosLibres: TurnoLibre[] = [];

  for (const turno of turnos) {
    const clasesDelTurno = clases.filter((clase) => sePisan(clase, turno));
    const profesorOAlumnoOcupado = clasesDelTurno.some(
      (clase) =>
        clase.profesor.toString() === idProfesor ||
        (idAlumno !== undefined && clase.alumno.toString() === idAlumno),
    );
    const autosLibres = autos.filter(
      (auto) => !clasesDelTurno.some((clase) => clase.auto.equals(auto._id)),
    );

    if (!profesorOAlumnoOcupado && autosLibres.length > 0) {
      turnosLibres.push({ ...turno, autos: autosLibres });
    }
  }

  return turnosLibres;
}

// ============================================================
//  listarTurnosLibres — null si el profesor no existe (404)
// ============================================================
// "consulta" ya es un ConsultarTurnosDto: la forma la validó el
// controller. Los errores salen en este orden: fecha pasada (400),
// cuenta borrada (403), profesor inexistente (404), sin saldo (409).
export async function listarTurnosLibres(
  idProfesor: string,
  consulta: ConsultarTurnosDto,
  actor: ActorClase,
): Promise<TurnosLibres | null> {
  exigirFechaNoPasada(consulta.fecha);
  const alumno = await cuentaQueConsulta(actor);
  const [profesor, horarioEscuela, autos] = await Promise.all([
    profesorService.obtenerPorId(idProfesor),
    horarioEscuelaService.obtener(),
    autoService.listarActivos(consulta.cambios),
  ]);
  let resultado: TurnosLibres | null = null;

  if (profesor !== null) {
    exigirSaldo(alumno);
    const dia = diaDeLaSemana(consulta.fecha);
    const idProfesorEncontrado = profesor._id.toString();
    const idAlumno = alumno?._id.toString();

    const ventanas = ventanasDelDia(
      profesor.disponibilidad[dia],
      horarioEscuela[dia],
      rangoPedido(consulta),
    );
    const turnos = turnosDelDia(consulta.fecha, ventanas);
    const clases = await clasesQuePisan(turnos, idProfesorEncontrado, idAlumno, autos);

    resultado = {
      fecha: formatearFecha(consulta.fecha),
      dia,
      turnos: conAutosLibres(turnos, clases, autos, idProfesorEncontrado, idAlumno),
    };
  }

  return resultado;
}
