import { DateTime } from 'luxon';

// Expresión regular para validar horas en punto entre "00:00" y "24:00".
export const REGEX_HORA_EN_PUNTO = /^(?:[01]\d|2[0-3]):00$|^24:00$/;

// Expresión regular para validar fechas ISO locales en hora en punto: "YYYY-MM-DDTHH:00".
export const REGEX_FECHA_HORA_EN_PUNTO = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):00$/;

// Expresión regular para validar fecha calendario en formato "YYYY-MM-DD".
export const REGEX_FECHA_DIA_YYYY_MM_DD =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

// Día arbitrario de referencia usado para proyectar tramos horarios de un mismo día
// en objetos Interval de Luxon y poder operar con ellos (merge, difference, length).
export const DIA_BASE_REFERENCIA = DateTime.fromISO('2026-01-05T00:00');

// Constantes de reglas de negocio de horarios y duraciones.
export const MIN_DURACION_TRAMO_HORAS = 1;
export const DURACION_CLASE_HORAS = 1;
export const HORA_CIERRE_DIA = '24:00';
