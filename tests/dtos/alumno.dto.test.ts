// ============================================================
//  alumno.dto.test.ts — Tests de src/dtos/alumno.dto.ts (sin DB)
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  aActualizarAlumnoDto,
  aCantidadClasesDto,
  aCrearAlumnoDto,
} from '../../src/dtos/alumno.dto.js';
import { ErrorDeNegocio } from '../../src/errors/errorDeNegocio.js';
import { ErrorPeticionInvalida } from '../../src/errors/errorPeticionInvalida.js';

const datosValidos = {
  email: 'ana@example.com',
  password: 'claveSegura123',
  nomApe: 'Ana Pérez',
};

describe('aCrearAlumnoDto', () => {
  it('devuelve un objeto nuevo con los tres campos', () => {
    const dto = aCrearAlumnoDto(datosValidos);

    expect(dto).toEqual(datosValidos);
    expect(dto).not.toBe(datosValidos);
  });

  it.each([null, [], 'texto'])('rechaza un body que no es un objeto (%j)', (body) => {
    expect(() => aCrearAlumnoDto(body)).toThrow(ErrorPeticionInvalida);
  });

  // El saldo inicial lo fija el service: si el cliente lo manda, se le
  // dice dónde se cambia.
  it('rechaza clasesPorReservar, con la pista de dónde se cambia el saldo', () => {
    expect(() => aCrearAlumnoDto({ ...datosValidos, clasesPorReservar: 100 })).toThrow(
      'No se pueden enviar estos campos: clasesPorReservar (el saldo de clases se cambia con sumar-clases / restar-clases)',
    );
  });

  it.each([
    [{ rol: 'administrador' }, 'rol'],
    [{ _id: '64b7f0f0f0f0f0f0f0f0f0f0' }, '_id'],
  ])('rechaza campos que no son del contrato (%j)', (extra, campo) => {
    expect(() => aCrearAlumnoDto({ ...datosValidos, ...extra })).toThrow(
      `No se pueden enviar estos campos: ${campo}`,
    );
  });

  it.each([
    [{ email: 123 }, 'El email debe ser un texto'],
    [{ password: null }, 'La contraseña debe ser un texto'],
    [{ nomApe: false }, 'El nombre y apellido debe ser un texto'],
  ])('rechaza tipos incorrectos (%j)', (cambio, mensaje) => {
    const llamada = () => aCrearAlumnoDto({ ...datosValidos, ...cambio });

    expect(llamada).toThrow(ErrorDeNegocio);
    expect(llamada).toThrow(mensaje);
  });

  it.each([
    ['email', 'El email es obligatorio'],
    ['password', 'La contraseña es obligatoria'],
    ['nomApe', 'El nombre y apellido es obligatorio'],
  ] as const)('exige que esté el campo %s', (campo, mensaje) => {
    const { [campo]: _omitido, ...sinCampo } = datosValidos;

    expect(() => aCrearAlumnoDto(sinCampo)).toThrow(mensaje);
  });
});

describe('aActualizarAlumnoDto', () => {
  it('acepta un solo campo', () => {
    expect(aActualizarAlumnoDto({ nomApe: 'Ana Gómez' })).toEqual({ nomApe: 'Ana Gómez' });
  });

  it('rechaza clasesPorReservar, con la pista de dónde se cambia el saldo', () => {
    expect(() => aActualizarAlumnoDto({ clasesPorReservar: 5 })).toThrow(
      'No se pueden modificar estos campos: clasesPorReservar (el saldo de clases se cambia con sumar-clases / restar-clases)',
    );
  });

  it.each([
    [{ rol: 'administrador' }, 'rol'],
    [{ _id: '64b7f0f0f0f0f0f0f0f0f0f0' }, '_id'],
    [{ nomApe: 'X', color: 'rojo' }, 'color'],
    [{ $set: { clasesPorReservar: 99 } }, '$set'],
  ])('rechaza campos que no se pueden modificar (%j)', (body, campo) => {
    expect(() => aActualizarAlumnoDto(body)).toThrow(`No se pueden modificar estos campos: ${campo}`);
  });

  it('rechaza un objeto vacío', () => {
    expect(() => aActualizarAlumnoDto({})).toThrow('Debe indicarse al menos un campo para actualizar');
  });

  it.each([
    [{ email: 123 }, 'El email debe ser un texto'],
    [{ nomApe: null }, 'El nombre y apellido debe ser un texto'],
    [{ password: 12345678 }, 'La contraseña debe ser un texto'],
  ])('rechaza tipos incorrectos (%j)', (body, mensaje) => {
    expect(() => aActualizarAlumnoDto(body)).toThrow(mensaje);
  });
});

describe('aCantidadClasesDto', () => {
  it('devuelve la cantidad', () => {
    expect(aCantidadClasesDto({ cantidad: 2 })).toEqual({ cantidad: 2 });
  });

  // Que sea un entero mayor que 0 es una regla: la revisa el service.
  it('deja pasar un número aunque no sea entero', () => {
    expect(aCantidadClasesDto({ cantidad: 1.5 })).toEqual({ cantidad: 1.5 });
  });

  it.each(['2', null, true])('rechaza una cantidad que no es un número (%j)', (cantidad) => {
    expect(() => aCantidadClasesDto({ cantidad })).toThrow('La cantidad debe ser un número');
  });

  it('exige la cantidad', () => {
    expect(() => aCantidadClasesDto({})).toThrow('La cantidad es obligatoria');
  });

  it('rechaza campos de más', () => {
    expect(() => aCantidadClasesDto({ cantidad: 1, motivo: 'regalo' })).toThrow(
      'No se pueden enviar estos campos: motivo',
    );
  });
});
