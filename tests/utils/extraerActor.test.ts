// ============================================================
//  extraerActor.test.ts — Tests de utils/extraerActor.ts (sin DB ni HTTP)
// ============================================================
// extraerActor es la función que usan los controllers para pasarle el
// actor a un service.

import { describe, it, expect } from 'vitest';
import type { Request } from 'express';
import { extraerActor } from '../../src/utils/extraerActor.js';
import { ErrorAutenticacion } from '../../src/errors/errorAutenticacion.js';

describe('extraerActor', () => {
  it('pasa req.auth al formato del service ("role" -> "rol")', () => {
    const req = { auth: { id: '64b7f0f0f0f0f0f0f0f0f0f0', role: 'alumno' } } as Request;

    expect(extraerActor(req)).toEqual({ id: '64b7f0f0f0f0f0f0f0f0f0f0', rol: 'alumno' });
  });

  // Antes, con req.auth!, una ruta mal montada leía .id de undefined y
  // respondía 500.
  it('sin req.auth (ruta montada sin requireAuthentication) → 401', () => {
    const llamada = () => extraerActor({} as Request);

    expect(llamada).toThrow(ErrorAutenticacion);
    expect(llamada).toThrow('Se requiere autenticación válida');
  });
});
