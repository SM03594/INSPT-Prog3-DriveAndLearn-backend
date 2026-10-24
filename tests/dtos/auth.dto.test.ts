// ============================================================
//  auth.dto.test.ts — Tests de src/dtos/auth.dto.ts (sin DB)
// ============================================================

import { describe, it, expect } from 'vitest';
import { aLoginDto } from '../../src/dtos/auth.dto.js';
import { ErrorDeNegocio } from '../../src/errors/errorDeNegocio.js';

describe('aLoginDto', () => {
  it('devuelve el email y la contraseña', () => {
    expect(aLoginDto({ email: 'ana@example.com', password: 'clave' })).toEqual({
      email: 'ana@example.com',
      password: 'clave',
    });
  });

  // Antes respondían 401: un pedido mal armado es un 400 (I-29).
  it.each([
    [{ email: 'ana@example.com' }, 'La contraseña es obligatoria'],
    [{ password: 'clave' }, 'El email es obligatorio'],
    [{ email: 123, password: 'clave' }, 'El email debe ser un texto'],
    [{ email: 'ana@example.com', password: 12345678 }, 'La contraseña debe ser un texto'],
    [{ email: 'ana@example.com', password: 'clave', recordarme: true }, 'No se pueden enviar estos campos: recordarme'],
  ])('rechaza %j con un error 400', (body, mensaje) => {
    const llamada = () => aLoginDto(body);

    expect(llamada).toThrow(ErrorDeNegocio);
    expect(llamada).toThrow(mensaje);
  });
});
