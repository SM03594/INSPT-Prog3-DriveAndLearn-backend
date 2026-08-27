import { describe, it, expect } from 'vitest';
import { sumar } from './sumar';

describe('sumar', () => {
  it('suma dos números positivos', () => {
    expect(sumar(2, 3)).toBe(5);
  });

  it('suma con cero', () => {
    expect(sumar(7, 0)).toBe(7);
  });

  it('suma números negativos', () => {
    expect(sumar(-4, -6)).toBe(-10);
  });
});