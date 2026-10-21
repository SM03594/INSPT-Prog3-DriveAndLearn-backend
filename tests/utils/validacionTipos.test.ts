// ============================================================
//  validacionTipos.test.ts — Tests de src/utils/validacionTipos.ts (sin DB)
// ============================================================

import { describe, it, expect } from 'vitest';
import { DESCRIPCION_TIPO, esDelTipo } from '../../src/utils/validacionTipos.js';

describe('esDelTipo', () => {
  it.each([
    ['texto', 'string'],
    ['', 'string'],
    [3, 'number'],
    [1.5, 'number'],
    [true, 'boolean'],
    [false, 'boolean'],
  ] as const)('acepta %j como %s', (valor, tipo) => {
    expect(esDelTipo(valor, tipo)).toBe(true);
  });

  it.each([
    ['3', 'number'],
    [3, 'string'],
    ['true', 'boolean'],
    [0, 'boolean'],
    [null, 'string'],
    [undefined, 'string'],
    [{}, 'string'],
    [[], 'string'],
  ] as const)('rechaza %j como %s', (valor, tipo) => {
    expect(esDelTipo(valor, tipo)).toBe(false);
  });
});

describe('DESCRIPCION_TIPO', () => {
  it('describe cada tipo para los mensajes de error', () => {
    expect(DESCRIPCION_TIPO).toEqual({
      string: 'un texto',
      number: 'un número',
      boolean: 'verdadero o falso',
    });
  });
});
