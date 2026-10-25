// ============================================================
//  auto.dto.test.ts — Tests de src/dtos/auto.dto.ts (sin DB)
// ============================================================
// Los valores permitidos de "cambios" y el unique de la patente los
// valida el esquema: se prueban en auto.service.test.ts.

import { describe, it, expect } from 'vitest';
import { aActualizarAutoDto, aCambiarActivoDto, aCrearAutoDto } from '../../src/dtos/auto.dto.js';
import { ErrorDeNegocio } from '../../src/errors/errorDeNegocio.js';

const datosValidos = { marca: 'Fiat', modelo: 'Cronos', patente: 'AB123CD', cambios: 'MANUAL' };

describe('aCrearAutoDto', () => {
  it('devuelve un objeto nuevo con los campos que vinieron', () => {
    const dto = aCrearAutoDto(datosValidos);

    expect(dto).toEqual(datosValidos);
    expect(dto).not.toBe(datosValidos);
  });

  it('acepta activo: un auto puede nacer fuera de servicio', () => {
    expect(aCrearAutoDto({ ...datosValidos, activo: false })).toMatchObject({ activo: false });
  });

  it('marca y modelo son opcionales', () => {
    expect(aCrearAutoDto({ patente: 'AB123CD', cambios: 'MANUAL' })).toEqual({ patente: 'AB123CD', cambios: 'MANUAL' });
  });

  it.each([
    [{ color: 'rojo' }, 'color'],
    [{ _id: '64b7f0f0f0f0f0f0f0f0f0f0' }, '_id'],
    [{ createdAt: '2000-01-01' }, 'createdAt'],
  ])('rechaza campos que no son del contrato (%j)', (extra, campo) => {
    expect(() => aCrearAutoDto({ ...datosValidos, ...extra })).toThrow(`No se pueden enviar estos campos: ${campo}`);
  });

  it.each([
    [{ marca: 123 }, 'La marca debe ser un texto'],
    [{ patente: 12345 }, 'La patente debe ser un texto'],
    [{ activo: 'true' }, 'El campo activo debe ser verdadero o falso'],
  ])('rechaza tipos incorrectos en vez de convertirlos (%j)', (cambio, mensaje) => {
    const llamada = () => aCrearAutoDto({ ...datosValidos, ...cambio });

    expect(llamada).toThrow(ErrorDeNegocio);
    expect(llamada).toThrow(mensaje);
  });

  it.each([
    ['patente', 'La patente es obligatoria'],
    ['cambios', 'El tipo de cambios es obligatorio'],
  ] as const)('exige que esté el campo %s', (campo, mensaje) => {
    const { [campo]: _omitido, ...sinCampo } = datosValidos;

    expect(() => aCrearAutoDto(sinCampo)).toThrow(mensaje);
  });
});

describe('aActualizarAutoDto', () => {
  it('acepta un solo campo', () => {
    expect(aActualizarAutoDto({ modelo: 'Cronos Drive' })).toEqual({ modelo: 'Cronos Drive' });
  });

  it('rechaza activo, con la pista de dónde se cambia el estado', () => {
    expect(() => aActualizarAutoDto({ activo: false })).toThrow(
      'No se pueden modificar estos campos: activo (el estado se cambia con PATCH /autos/:id/activo)',
    );
  });

  it.each([
    [{ $set: { activo: false } }, '$set'],
    [{ _id: '64b7f0f0f0f0f0f0f0f0f0f0' }, '_id'],
    [{ color: 'rojo' }, 'color'],
  ])('rechaza campos que no se pueden modificar (%j)', (body, campo) => {
    expect(() => aActualizarAutoDto(body)).toThrow(`No se pueden modificar estos campos: ${campo}`);
  });

  it('rechaza un objeto vacío', () => {
    expect(() => aActualizarAutoDto({})).toThrow('Debe indicarse al menos un campo para actualizar');
  });

  it('rechaza una marca que no es texto', () => {
    expect(() => aActualizarAutoDto({ marca: 123 })).toThrow('La marca debe ser un texto');
  });
});

describe('aCambiarActivoDto', () => {
  it.each([true, false])('acepta activo: %s', (activo) => {
    expect(aCambiarActivoDto({ activo })).toEqual({ activo });
  });

  it.each(['false', 0, null])('rechaza un activo que no es booleano (%j)', (activo) => {
    expect(() => aCambiarActivoDto({ activo })).toThrow('El campo activo debe ser verdadero o falso');
  });

  it('exige activo', () => {
    expect(() => aCambiarActivoDto({})).toThrow('El campo activo es obligatorio');
  });

  it('rechaza campos de más', () => {
    expect(() => aCambiarActivoDto({ activo: false, motivo: 'x' })).toThrow('No se pueden enviar estos campos: motivo');
  });
});
