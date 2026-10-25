// ============================================================
//  validacionDeCuerpo.test.ts — Tests de validacionDeCuerpo (sin DB)
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import {
  validacionDeCuerpo,
  verificarCuerpo,
} from '../../src/middlewares/validacionDeCuerpo.middleware.js';
import { ErrorPeticionSinCuerpo } from '../../src/errors/errorPeticionSinCuerpo.js';
import { ErrorJsonInvalido } from '../../src/errors/errorJsonInvalido.js';
import { ErrorLecturaCuerpo, verSiErrorLecturaCuerpo } from '../../src/errors/errorLecturaCuerpo.js';

// Un pedido armado a mano: solo lo que mira verificarCuerpo.
function pedido(body: unknown, contentLength?: string) {
  return {
    body,
    headers: contentLength === undefined ? {} : { 'content-length': contentLength },
  };
}

describe('verificarCuerpo', () => {
  it('sin body (req.body undefined) → ErrorPeticionSinCuerpo', () => {
    expect(() => verificarCuerpo(pedido(undefined))).toThrow(ErrorPeticionSinCuerpo);
  });

  it('body vacío con Content-Type JSON (express.json deja {}) → ErrorPeticionSinCuerpo', () => {
    expect(() => verificarCuerpo(pedido({}, '0'))).toThrow(ErrorPeticionSinCuerpo);
  });

  it('un array → ErrorJsonInvalido', () => {
    expect(() => verificarCuerpo(pedido([], '2'))).toThrow(ErrorJsonInvalido);
    expect(() => verificarCuerpo(pedido([], '2'))).toThrow(
      'El cuerpo de la petición debe ser un objeto JSON',
    );
  });

  it('los dos errores responden 400', () => {
    expect(new ErrorPeticionSinCuerpo()).toMatchObject({
      status: 400,
      message: 'La petición debe incluir un cuerpo JSON',
    });
    expect(new ErrorJsonInvalido('x')).toMatchObject({ status: 400 });
  });

  it('un objeto → lo devuelve tal cual', () => {
    const body = { nomApe: 'Ana' };

    expect(verificarCuerpo(pedido(body, '16'))).toBe(body);
  });

  it('un objeto vacío mandado de verdad ("{}") pasa: decide el service', () => {
    expect(verificarCuerpo(pedido({}, '2'))).toEqual({});
  });
});

describe('validacionDeCuerpo', () => {
  const res = {} as Response;

  it('llama a next() si el body es un objeto', () => {
    const next = vi.fn();

    validacionDeCuerpo(pedido({ a: 1 }, '7') as Request, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('lanza (y no llama a next) si no hay body', () => {
    const next = vi.fn();

    expect(() => validacionDeCuerpo(pedido(undefined) as Request, res, next)).toThrow(
      ErrorPeticionSinCuerpo,
    );
    expect(next).not.toHaveBeenCalled();
  });
});

// El JSON mal escrito no llega al middleware: express.json() lo
// rechaza antes, y verSiErrorLecturaCuerpo lo traduce.
describe('verSiErrorLecturaCuerpo', () => {
  it('JSON mal escrito → ErrorJsonInvalido', () => {
    const crudo = { type: 'entity.parse.failed', status: 400 };

    const err = verSiErrorLecturaCuerpo(crudo);
    expect(err).toBeInstanceOf(ErrorJsonInvalido);
    expect(err).toMatchObject({
      status: 400,
      message: 'El cuerpo de la petición no es un JSON válido',
    });
  });

  it('body demasiado grande → sigue siendo ErrorLecturaCuerpo (413)', () => {
    const crudo = { type: 'entity.too.large', status: 413 };

    const err = verSiErrorLecturaCuerpo(crudo);
    expect(err).toBeInstanceOf(ErrorLecturaCuerpo);
    expect(err).toMatchObject({ status: 413 });
  });
});
