// ============================================================
//  tramo.service.test.ts — Tests de las reglas de un tramo
// ============================================================
// Todas son funciones PURAS: no tocan la base, así que no hace falta
// setupTestDB().

import { describe, it, expect } from 'vitest';
import {
  aIntervalo,
  cruzarIntervalos,
  entraEnAlgunTramo,
  validarTramoEnPunto,
} from '../../src/services/tramo.service.js';
import type { Tramo } from '../../src/models/Tramo.js';

const MENSAJE_EN_PUNTO = 'Los tramos deben empezar y terminar en una hora en punto';

const tramo = (inicio: [number, number], fin: [number, number]): Tramo => ({
  horaInicio: { hora: inicio[0], minuto: inicio[1] },
  horaFin: { hora: fin[0], minuto: fin[1] },
});

describe('validarTramoEnPunto', () => {
  it('acepta un tramo en punto (09:00–12:00)', () => {
    expect(() => validarTramoEnPunto(tramo([9, 0], [12, 0]))).not.toThrow();
  });

  it.each([
    ['el inicio', tramo([8, 30], [12, 0])],
    ['el fin', tramo([9, 0], [12, 30])],
    ['los dos', tramo([8, 15], [12, 45])],
  ])('rechaza un tramo con minutos en %s', (_caso, tramoConMinutos) => {
    expect(() => validarTramoEnPunto(tramoConMinutos)).toThrow(MENSAJE_EN_PUNTO);
  });

  it('rechaza un minuto que llega como texto ("30"): Mongoose lo guardaría como 30', () => {
    const conTexto = {
      horaInicio: { hora: 9, minuto: 0 },
      horaFin: { hora: 12, minuto: '30' },
    } as unknown as Tramo;

    expect(() => validarTramoEnPunto(conTexto)).toThrow(MENSAJE_EN_PUNTO);
  });

  // Estos casos no son en punto, pero el mensaje más preciso lo da el
  // esquema al guardar: acá no se rechazan.
  it.each([
    ['un minuto fuera de rango (99)', tramo([9, 99], [12, 0])],
    ['un minuto negativo', tramo([9, -5], [12, 0])],
    ['un minuto que no es un número', { horaInicio: { hora: 9, minuto: 'abc' }, horaFin: { hora: 12, minuto: 0 } }],
    ['una hora que falta', { horaFin: { hora: 12, minuto: 0 } }],
    ['una hora que no es un objeto', { horaInicio: '09:00', horaFin: { hora: 12, minuto: 0 } }],
  ])('deja pasar %s (lo rechaza el esquema)', (_caso, tramoMalFormado) => {
    expect(() => validarTramoEnPunto(tramoMalFormado as unknown as Tramo)).not.toThrow();
  });
});

describe('aIntervalo', () => {
  it('pasa el tramo a minutos desde medianoche', () => {
    expect(aIntervalo(tramo([9, 0], [12, 30]))).toEqual({ inicio: 540, fin: 750 });
  });
});

describe('entraEnAlgunTramo', () => {
  const pegados = [tramo([8, 0], [10, 0]), tramo([10, 0], [12, 0])];

  it('acepta un intervalo que entra entero en un tramo, incluso tocando los bordes', () => {
    expect(entraEnAlgunTramo(pegados, { inicio: 8 * 60, fin: 9 * 60 })).toBe(true);
    expect(entraEnAlgunTramo(pegados, { inicio: 9 * 60, fin: 10 * 60 })).toBe(true);
  });

  it('rechaza un intervalo que solo entra entre dos tramos pegados', () => {
    expect(entraEnAlgunTramo(pegados, { inicio: 9 * 60 + 30, fin: 10 * 60 + 30 })).toBe(false);
  });

  it('sin tramos, nada entra', () => {
    expect(entraEnAlgunTramo([], { inicio: 9 * 60, fin: 10 * 60 })).toBe(false);
  });
});

describe('cruzarIntervalos', () => {
  it('devuelve la parte en común', () => {
    expect(cruzarIntervalos({ inicio: 540, fin: 780 }, { inicio: 480, fin: 720 }))
      .toEqual({ inicio: 540, fin: 720 });
  });

  it('devuelve null si solo se tocan en un punto o no se tocan', () => {
    expect(cruzarIntervalos({ inicio: 540, fin: 600 }, { inicio: 600, fin: 720 })).toBeNull();
    expect(cruzarIntervalos({ inicio: 540, fin: 600 }, { inicio: 660, fin: 720 })).toBeNull();
  });
});
