// ============================================================
//  env.test.ts — Tests de la lectura de OFFSET_HORA_UTC (sin DB)
// ============================================================
// env.ts lee process.env al importarse: cada test cambia la variable
// con vi.stubEnv y vuelve a importar el módulo de cero.

import { describe, it, expect, vi, afterEach } from 'vitest';

async function importarEnv() {
  vi.resetModules();
  const env = await import('../../src/config/env.js');
  return env;
}

describe('OFFSET_HORA_UTC', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it.each([
    ['-3', -3],
    ['5.5', 5.5],
    ['0', 0],
  ])('acepta %s', async (valor, horas) => {
    vi.stubEnv('OFFSET_HORA_UTC', valor);
    const { OFFSET_HORA_UTC } = await importarEnv();
    expect(OFFSET_HORA_UTC).toBe(horas);
  });

  it('vacío ("OFFSET_HORA_UTC=" en el .env) usa -3', async () => {
    vi.stubEnv('OFFSET_HORA_UTC', '');
    const { OFFSET_HORA_UTC } = await importarEnv();
    expect(OFFSET_HORA_UTC).toBe(-3);
  });

  it('frena el arranque si no es un número', async () => {
    vi.stubEnv('OFFSET_HORA_UTC', 'abc');
    await expect(importarEnv()).rejects.toThrow(
      'OFFSET_HORA_UTC debe ser un número de horas (por ejemplo, -3)',
    );
  });
});
