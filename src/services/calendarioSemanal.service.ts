// ============================================================
//  calendarioSemanal.service.ts — Operaciones sobre un CalendarioSemanal
// ============================================================
// Un CalendarioSemanal es { lunes: [tramo], martes: [...], ... }.
// Acá viven las operaciones que lo modifican (agregar / quitar un
// tramo de un día).
// ============================================================

import {
  DIAS,
  type CalendarioSemanal,
  type Dia,
  type Tramo,
} from '../models/CalendarioSemanal.js';
import type { HoraDelDia } from '../models/Horario.js';
import { ErrorDeNegocio } from '../errors/errorDeNegocio.js';

// ============================================================
//  validarDia — rechaza un día que no está en DIAS
// ============================================================
export function validarDia(dia: string): asserts dia is Dia {
  if (!(DIAS as readonly string[]).includes(dia)) {
    throw new ErrorDeNegocio(
      `Día inválido: "${dia}". Debe ser uno de: ${DIAS.join(', ')}.`,
    );
  }
}

function validarHoraDelDia(valor: unknown, nombre: string): HoraDelDia {
  if (
    typeof valor !== 'object' ||
    valor === null ||
    Array.isArray(valor)
  ) {
    throw new ErrorDeNegocio(`${nombre} debe ser un objeto con hora y minuto`);
  }

  const hora = valor as Record<string, unknown>;
  if (
    typeof hora.hora !== 'number' ||
    !Number.isInteger(hora.hora) ||
    hora.hora < 0 ||
    hora.hora > 23
  ) {
    throw new ErrorDeNegocio(`${nombre}: la hora debe ser un entero entre 0 y 23`);
  }
  if (
    typeof hora.minuto !== 'number' ||
    !Number.isInteger(hora.minuto) ||
    hora.minuto < 0 ||
    hora.minuto > 59
  ) {
    throw new ErrorDeNegocio(`${nombre}: los minutos deben ser un entero entre 0 y 59`);
  }

  return { hora: hora.hora, minuto: hora.minuto };
}

// Valida y reconstruye el tramo para que solo datos completos y coherentes
// lleguen a modificar un calendario o a persistirse mediante Mongoose.
export function validarTramo(valor: unknown): Tramo {
  if (
    typeof valor !== 'object' ||
    valor === null ||
    Array.isArray(valor)
  ) {
    throw new ErrorDeNegocio('El tramo debe ser un objeto');
  }

  const datos = valor as Record<string, unknown>;
  const horaInicio = validarHoraDelDia(datos.horaInicio, 'La hora de inicio');
  const horaFin = validarHoraDelDia(datos.horaFin, 'La hora de fin');
  const inicioEnMinutos = horaInicio.hora * 60 + horaInicio.minuto;
  const finEnMinutos = horaFin.hora * 60 + horaFin.minuto;

  if (finEnMinutos <= inicioEnMinutos) {
    throw new ErrorDeNegocio(
      'La hora de fin debe ser posterior a la de inicio',
    );
  }

  return { horaInicio, horaFin };
}

// ============================================================
//  agregarTramo — suma un tramo al día indicado
// ============================================================
export function agregarTramo(
  calendario: CalendarioSemanal,
  dia: Dia,
  tramoEntrada: unknown,
): void {
  validarDia(dia);
  // Validar antes de mutar el calendario evita dejarlo en un estado inválido.
  const tramo = validarTramo(tramoEntrada);
  calendario[dia].push(tramo);
}

// ============================================================
//  quitarTramo — saca el tramo con ese _id del día indicado
// ============================================================
// Devuelve true si lo encontró y lo quitó; false si ese día no
// tenía ningún tramo con ese _id.
export function quitarTramo(
  calendario: CalendarioSemanal,
  dia: Dia,
  tramoId: string,
): boolean {
  validarDia(dia);

  const tramos = calendario[dia];
  const indice = tramos.findIndex((t) => t._id?.toString() === tramoId);
  if (indice === -1) return false;

  tramos.splice(indice, 1);
  return true;
}
