// ============================================================
//  env.test.ts — Tests de la lectura de OFFSET_UTC (sin DB)
// ============================================================
// parsearOffsetUtc recibe el valor como parámetro: se prueba sin tocar
// process.env.

import { describe, it, expect } from 'vitest';
import { parsearOffsetUtc } from '../../src/config/env.js';

const MENSAJE = 'OFFSET_UTC debe tener el formato ±HH:MM (por ejemplo, -03:00)';

describe('parsearOffsetUtc', () => {
  it('sin valor usa -03:00', () => {
    expect(parsearOffsetUtc(undefined)).toEqual({ texto: '-03:00', minutos: -180 });
  });

  it('vacío ("OFFSET_UTC=" en el .env) también usa -03:00', () => {
    expect(parsearOffsetUtc('')).toEqual({ texto: '-03:00', minutos: -180 });
    expect(parsearOffsetUtc('   ')).toEqual({ texto: '-03:00', minutos: -180 });
  });

  it.each([
    ['-03:00', -180],
    ['+05:30', 330],
    ['+00:00', 0],
    ['-14:00', -840],
    [' -03:00 ', -180],
  ])('acepta %s', (valor, minutos) => {
    expect(parsearOffsetUtc(valor).minutos).toBe(minutos);
  });

  it.each(['-3', '03:00', '-0300', 'UTC', 'America/Argentina/Buenos_Aires', '-15:00', '+03:60'])(
    'rechaza %s',
    (valor) => {
      expect(() => parsearOffsetUtc(valor)).toThrow(MENSAJE);
    },
  );
});
