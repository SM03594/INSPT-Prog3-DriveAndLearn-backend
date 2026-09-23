// ============================================================
//  fechas.test.ts — Tests de src/utils/fechas.ts (sin DB)
// ============================================================
// vitest.config.ts corre el proceso con TZ=UTC: si aHoraLocal usara
// la zona del proceso en vez de ZONA_HORARIA, estos tests fallarían.

import { describe, it, expect } from 'vitest';
import { aHoraLocal, parsearInstante } from '../../src/utils/fechas.js';
import { ErrorDeNegocio } from '../../src/errors/errorDeNegocio.js';

describe('parsearInstante', () => {
  it('acepta ISO con offset', () => {
    expect(
      parsearInstante('2026-09-20T09:00:00-03:00', 'inicio')?.toISOString(),
    ).toBe('2026-09-20T12:00:00.000Z');
  });

  it('acepta ISO en UTC (Z), como el de toISOString()', () => {
    expect(
      parsearInstante('2026-09-20T12:00:00.000Z', 'inicio')?.toISOString(),
    ).toBe('2026-09-20T12:00:00.000Z');
  });

  it('devuelve el mismo Date si ya recibe un Date', () => {
    const d = new Date('2026-09-20T12:00:00Z');
    expect(parsearInstante(d, 'inicio')).toBe(d);
  });

  it('deja pasar undefined (lo decide el required del Schema)', () => {
    expect(parsearInstante(undefined, 'inicio')).toBeUndefined();
  });

  it.each([
    ['sin zona', '2026-09-20T09:00:00'],
    ['solo fecha', '2026-09-20'],
    ['texto cualquiera', 'mañana'],
    ['fecha imposible', '2026-02-31T09:00:00Z'],
    ['hora imposible', '2026-09-20T25:00:00Z'],
  ])('rechaza %s', (_caso, valor) => {
    expect(() => parsearInstante(valor, 'inicio')).toThrow(ErrorDeNegocio);
  });

  it('rechaza valores que no son string ni Date', () => {
    expect(() => parsearInstante(1758369600000, 'fin')).toThrow(/fin/);
  });
});

describe('aHoraLocal', () => {
  it('traduce el instante a día y hora de la escuela (Argentina)', () => {
    // 12:00 UTC del domingo 20/09/2026 = 09:00 en Argentina.
    expect(aHoraLocal(new Date('2026-09-20T12:00:00Z'))).toEqual({
      dia: 'domingo',
      hora: 9,
      minuto: 0,
    });
  });

  it('usa el día local aunque en UTC ya sea el día siguiente', () => {
    // 01:30 UTC del lunes 21 = 22:30 del domingo 20 en Argentina.
    expect(aHoraLocal(new Date('2026-09-21T01:30:00Z'))).toEqual({
      dia: 'domingo',
      hora: 22,
      minuto: 30,
    });
  });

  it('medianoche local es hora 0, no 24', () => {
    // 03:00 UTC = 00:00 en Argentina.
    expect(aHoraLocal(new Date('2026-09-21T03:00:00Z'))).toEqual({
      dia: 'lunes',
      hora: 0,
      minuto: 0,
    });
  });
});
