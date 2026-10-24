// ============================================================
//  calendarioSemanal.dto.test.ts — Tests de src/dtos/calendarioSemanal.dto.ts (sin DB)
// ============================================================
// Estos DTO los comparten el horario de la escuela y la disponibilidad
// de los profesores. Que el día exista y las horas de cada tramo son
// reglas: se prueban en los tests de los services.

import { describe, it, expect } from 'vitest';
import {
  aAgregarTramoDto,
  aQuitarTramoDto,
  aReemplazarCalendarioDto,
} from '../../src/dtos/calendarioSemanal.dto.js';

const TRAMO = { horaInicio: { hora: 9, minuto: 0 }, horaFin: { hora: 12, minuto: 0 } };
const SEMANA = { lunes: [TRAMO], martes: [], miercoles: [], jueves: [], viernes: [], sabado: [], domingo: [] };

describe('aAgregarTramoDto', () => {
  it('devuelve el día y el tramo', () => {
    expect(aAgregarTramoDto({ dia: 'lunes', tramo: TRAMO })).toEqual({ dia: 'lunes', tramo: TRAMO });
  });

  // Antes, un body sin "tramo" guardaba un null en el horario de la
  // escuela y rompía las reservas de ese día (I-32), y un tramo de texto
  // devolvía un mensaje interno de Mongoose (I-36).
  it.each([
    [{ dia: 'lunes' }, 'El tramo es obligatorio'],
    [{ dia: 'lunes', tramo: 'mañana' }, 'El tramo debe ser un objeto'],
    [{ dia: 'lunes', tramo: [] }, 'El tramo debe ser un objeto'],
    [{ dia: 'lunes', tramo: null }, 'El tramo debe ser un objeto'],
    [{ dia: 1, tramo: TRAMO }, 'El día debe ser un texto'],
    [{ tramo: TRAMO }, 'El día es obligatorio'],
    [{ dia: 'lunes', tramo: TRAMO, extra: 1 }, 'No se pueden enviar estos campos: extra'],
  ])('rechaza %j', (body, mensaje) => {
    expect(() => aAgregarTramoDto(body)).toThrow(mensaje);
  });
});

describe('aQuitarTramoDto', () => {
  it('devuelve el día y el id del tramo', () => {
    expect(aQuitarTramoDto({ dia: 'lunes', tramoId: 'abc' })).toEqual({ dia: 'lunes', tramoId: 'abc' });
  });

  // Antes, en el horario de la escuela, un tramoId numérico respondía 404
  // "No se encontró el tramo" (I-50).
  it.each([
    [{ dia: 'lunes', tramoId: 123 }, 'El identificador del tramo debe ser un texto'],
    [{ dia: 'lunes' }, 'El identificador del tramo es obligatorio'],
    [{ dia: 1, tramoId: 'abc' }, 'El día debe ser un texto'],
  ])('rechaza %j', (body, mensaje) => {
    expect(() => aQuitarTramoDto(body)).toThrow(mensaje);
  });
});

describe('aReemplazarCalendarioDto', () => {
  it('devuelve los 7 días con sus tramos', () => {
    expect(aReemplazarCalendarioDto(SEMANA)).toEqual(SEMANA);
  });

  it('exige los 7 días', () => {
    const { domingo: _omitido, ...sinDomingo } = SEMANA;

    expect(() => aReemplazarCalendarioDto(sinDomingo)).toThrow('El domingo es obligatorio');
  });

  it('rechaza un día que no es una lista', () => {
    expect(() => aReemplazarCalendarioDto({ ...SEMANA, lunes: 'x' })).toThrow('El lunes debe ser una lista');
  });

  // Un null guardado en el calendario rompe las reservas de ese día.
  it.each([[[null]], [['x']], [[5]]])('rechaza tramos que no son objetos (%j)', (tramos) => {
    expect(() => aReemplazarCalendarioDto({ ...SEMANA, martes: tramos })).toThrow(
      'Cada tramo del martes debe ser un objeto',
    );
  });

  // Antes, un día que no existe se descartaba en silencio (I-37).
  it('rechaza un día que no existe', () => {
    expect(() => aReemplazarCalendarioDto({ ...SEMANA, feriado: [] })).toThrow(
      'No se pueden enviar estos campos: feriado',
    );
  });
});
