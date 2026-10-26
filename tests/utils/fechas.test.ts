// ============================================================
//  fechas.test.ts — Tests de src/utils/fechas.ts (sin DB)
// ============================================================
// vitest.config.ts corre el proceso con TZ=UTC: si aHoraLocal usara
// la zona del proceso en vez de OFFSET_HORA_UTC, estos tests fallarían.
// Sin OFFSET_HORA_UTC en el entorno, el offset es el de por defecto, -3.

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  aHoraLocal,
  compararFechas,
  diaDeLaSemana,
  formatearFecha,
  hoyEnLaEscuela,
  instanteLocal,
  parsearInstante,
} from '../../src/utils/fechas.js';
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

describe('diaDeLaSemana', () => {
  it('no depende de la zona horaria', () => {
    expect(diaDeLaSemana({ anio: 2026, mes: 11, diaDelMes: 8 })).toBe('domingo');
    expect(diaDeLaSemana({ anio: 2026, mes: 11, diaDelMes: 9 })).toBe('lunes');
  });
});

describe('hoyEnLaEscuela', () => {
  it('a las 01:00 UTC todavía es el día anterior en la escuela', () => {
    expect(hoyEnLaEscuela(new Date('2026-11-10T01:00:00Z')))
      .toEqual({ anio: 2026, mes: 11, diaDelMes: 9 });
  });

  it('a las 03:00 UTC ya es el día siguiente (00:00 en la escuela)', () => {
    expect(hoyEnLaEscuela(new Date('2026-11-10T03:00:00Z')))
      .toEqual({ anio: 2026, mes: 11, diaDelMes: 10 });
  });
});

describe('compararFechas y formatearFecha', () => {
  it('compara días del calendario', () => {
    const lunes = { anio: 2026, mes: 11, diaDelMes: 9 };
    expect(compararFechas(lunes, { anio: 2026, mes: 11, diaDelMes: 10 })).toBeLessThan(0);
    expect(compararFechas(lunes, { ...lunes })).toBe(0);
    expect(compararFechas(lunes, { anio: 2026, mes: 10, diaDelMes: 31 })).toBeGreaterThan(0);
  });

  it('formatea como AAAA-MM-DD', () => {
    expect(formatearFecha({ anio: 2026, mes: 3, diaDelMes: 5 })).toBe('2026-03-05');
  });
});

describe('instanteLocal', () => {
  it('convierte la hora de la escuela a instante con OFFSET_HORA_UTC (-3)', () => {
    expect(instanteLocal({ anio: 2026, mes: 11, diaDelMes: 9 }, { hora: 9, minuto: 0 }).toISOString())
      .toBe('2026-11-09T12:00:00.000Z');
  });

  it('una hora de la noche cae al día siguiente en UTC', () => {
    expect(instanteLocal({ anio: 2026, mes: 11, diaDelMes: 9 }, { hora: 22, minuto: 0 }).toISOString())
      .toBe('2026-11-10T01:00:00.000Z');
  });

  it('es el camino inverso de aHoraLocal', () => {
    const fecha = { anio: 2026, mes: 11, diaDelMes: 9 };
    for (const hora of [0, 9, 13, 23]) {
      expect(aHoraLocal(instanteLocal(fecha, { hora, minuto: 0 })))
        .toEqual({ dia: 'lunes', hora, minuto: 0 });
    }
  });
});

describe('con otro OFFSET_HORA_UTC (5.5, o sea +05:30)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('instanteLocal y aHoraLocal usan el mismo offset', async () => {
    vi.stubEnv('OFFSET_HORA_UTC', '5.5');
    vi.resetModules();
    const fechas = await import('../../src/utils/fechas.js');
    const fecha = { anio: 2026, mes: 11, diaDelMes: 9 };

    const instante = fechas.instanteLocal(fecha, { hora: 9, minuto: 0 });

    expect(instante.toISOString()).toBe('2026-11-09T03:30:00.000Z');
    expect(fechas.aHoraLocal(instante)).toEqual({ dia: 'lunes', hora: 9, minuto: 0 });
  });
});
