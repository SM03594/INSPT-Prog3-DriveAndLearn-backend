// ============================================================
//  administrador.dto.test.ts — Tests de src/dtos/administrador.dto.ts (sin DB)
// ============================================================
// Los DTO validan la FORMA del body: qué campos llegan y de qué tipo.
// Lo que depende del dato (formato del email, unique, largo de la
// contraseña) se prueba en los tests del service.

import { describe, it, expect } from 'vitest';
import {
  aActualizarAdministradorDto,
  aCrearAdministradorDto,
} from '../../src/dtos/administrador.dto.js';
import { ErrorDeNegocio } from '../../src/errors/errorDeNegocio.js';
import { ErrorPeticionInvalida } from '../../src/errors/errorPeticionInvalida.js';

const datosValidos = {
  email: 'admin@example.com',
  password: 'claveAdmin123',
  nomApe: 'Admin Root',
};

describe('aCrearAdministradorDto', () => {
  it('devuelve un objeto nuevo con los tres campos', () => {
    const dto = aCrearAdministradorDto(datosValidos);

    expect(dto).toEqual(datosValidos);
    expect(dto).not.toBe(datosValidos);
  });

  it.each([null, [], 'texto'])('rechaza un body que no es un objeto (%j)', (body) => {
    expect(() => aCrearAdministradorDto(body)).toThrow(ErrorPeticionInvalida);
  });

  it.each([
    [{ rol: 'alumno' }, 'rol'],
    [{ clasesPorReservar: 9 }, 'clasesPorReservar'],
    [{ _id: '64b7f0f0f0f0f0f0f0f0f0f0' }, '_id'],
    [{ createdAt: '2000-01-01' }, 'createdAt'],
  ])('rechaza campos que no son del contrato (%j)', (extra, campo) => {
    expect(() => aCrearAdministradorDto({ ...datosValidos, ...extra })).toThrow(
      `No se pueden enviar estos campos: ${campo}`,
    );
  });

  it.each([
    [{ nomApe: 123 }, 'El nombre y apellido debe ser un texto'],
    [{ email: 123 }, 'El email debe ser un texto'],
    [{ password: 12345678 }, 'La contraseña debe ser un texto'],
  ])('rechaza tipos incorrectos en vez de convertirlos (%j)', (cambio, mensaje) => {
    const llamada = () => aCrearAdministradorDto({ ...datosValidos, ...cambio });

    expect(llamada).toThrow(ErrorDeNegocio);
    expect(llamada).toThrow(mensaje);
  });

  it.each([
    ['email', 'El email es obligatorio'],
    ['password', 'La contraseña es obligatoria'],
    ['nomApe', 'El nombre y apellido es obligatorio'],
  ] as const)('exige que esté el campo %s', (campo, mensaje) => {
    const { [campo]: _omitido, ...sinCampo } = datosValidos;

    expect(() => aCrearAdministradorDto(sinCampo)).toThrow(mensaje);
  });
});

describe('aActualizarAdministradorDto', () => {
  it('acepta un solo campo', () => {
    expect(aActualizarAdministradorDto({ nomApe: 'Otro' })).toEqual({ nomApe: 'Otro' });
  });

  // Antes, { $set: { password } } llegaba tal cual a findByIdAndUpdate:
  // la contraseña se guardaba sin hashear y la cuenta quedaba bloqueada.
  it.each([
    [{ $set: { password: 'corta' } }, '$set'],
    [{ _id: '64b7f0f0f0f0f0f0f0f0f0f0' }, '_id'],
    [{ rol: 'alumno' }, 'rol'],
    [{ nomApe: 'X', color: 'rojo' }, 'color'],
  ])('rechaza campos que no se pueden modificar (%j)', (body, campo) => {
    expect(() => aActualizarAdministradorDto(body)).toThrow(
      `No se pueden modificar estos campos: ${campo}`,
    );
  });

  it('rechaza un objeto vacío', () => {
    expect(() => aActualizarAdministradorDto({})).toThrow(
      'Debe indicarse al menos un campo para actualizar',
    );
  });

  it('rechaza un nomApe que no es texto en vez de convertirlo', () => {
    expect(() => aActualizarAdministradorDto({ nomApe: 123 })).toThrow(
      'El nombre y apellido debe ser un texto',
    );
  });
});
