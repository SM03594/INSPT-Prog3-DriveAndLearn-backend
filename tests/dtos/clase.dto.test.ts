// ============================================================
//  clase.dto.test.ts — Tests de src/dtos/clase.dto.ts (sin DB)
// ============================================================
// El formato de las fechas se valida acá: inicio y fin salen como Date.
// El formato de los ids, la duración, el horario y el saldo son reglas:
// se prueban en clase.service.test.ts.

import { describe, it, expect } from 'vitest';
import { aActualizarClaseDto, aCrearClaseDto } from '../../src/dtos/clase.dto.js';

const reserva = {
  profesor: '64b7f0f0f0f0f0f0f0f0f0f1',
  auto: '64b7f0f0f0f0f0f0f0f0f0f2',
  inicio: '2099-01-05T10:00:00-03:00',
  fin: '2099-01-05T11:00:00-03:00',
};
const ALUMNO = '64b7f0f0f0f0f0f0f0f0f0f3';

// Lo que devuelve el DTO: los mismos datos, con las fechas como Date.
const reservaConvertida = {
  ...reserva,
  inicio: new Date(reserva.inicio),
  fin: new Date(reserva.fin),
};

const MENSAJE_FECHA = 'debe ser una fecha ISO 8601 con zona horaria';

describe('aCrearClaseDto — alumno', () => {
  it('devuelve los cuatro campos de la reserva, con las fechas como Date', () => {
    const dto = aCrearClaseDto(reserva, 'alumno');

    expect(dto).toEqual(reservaConvertida);
    expect(dto.inicio).toBeInstanceOf(Date);
    // 10:00 en -03:00 es 13:00 en UTC: el mismo instante.
    expect(dto.inicio.toISOString()).toBe('2099-01-05T13:00:00.000Z');
  });

  it.each([
    ['sin zona horaria', '2099-01-05T10:00:00'],
    ['un día que no existe', '2099-02-31T10:00:00-03:00'],
    ['un texto que no es una fecha', 'mañana a las 10'],
  ])('rechaza un inicio %s', (_caso, inicio) => {
    expect(() => aCrearClaseDto({ ...reserva, inicio }, 'alumno')).toThrow(`El inicio ${MENSAJE_FECHA}`);
  });

  it('rechaza un fin sin zona horaria', () => {
    expect(() => aCrearClaseDto({ ...reserva, fin: '2099-01-05T11:00:00' }, 'alumno')).toThrow(
      `El fin ${MENSAJE_FECHA}`,
    );
  });

  it('rechaza que un alumno reserve a nombre de otro', () => {
    expect(() => aCrearClaseDto({ ...reserva, alumno: ALUMNO }, 'alumno')).toThrow(
      'No se pueden enviar estos campos: alumno',
    );
  });

  it.each([
    [{ estado: 'confirmada' }, 'estado'],
    [{ $set: { estado: 'confirmada' } }, '$set'],
  ])('rechaza campos que no son del contrato (%j)', (extra, campo) => {
    expect(() => aCrearClaseDto({ ...reserva, ...extra }, 'alumno')).toThrow(
      `No se pueden enviar estos campos: ${campo}`,
    );
  });

  it.each([
    [{ profesor: 123 }, 'El profesor debe ser un texto'],
    [{ inicio: 1758369600000 }, 'El inicio debe ser un texto'],
  ])('rechaza tipos incorrectos (%j)', (cambio, mensaje) => {
    expect(() => aCrearClaseDto({ ...reserva, ...cambio }, 'alumno')).toThrow(mensaje);
  });

  it.each([
    ['profesor', 'El profesor es obligatorio'],
    ['auto', 'El auto es obligatorio'],
    ['inicio', 'El inicio es obligatorio'],
    ['fin', 'El fin es obligatorio'],
  ] as const)('exige que esté el campo %s', (campo, mensaje) => {
    const { [campo]: _omitido, ...sinCampo } = reserva;

    expect(() => aCrearClaseDto(sinCampo, 'alumno')).toThrow(mensaje);
  });
});

describe('aCrearClaseDto — administrador', () => {
  it('acepta y devuelve el alumno', () => {
    expect(aCrearClaseDto({ ...reserva, alumno: ALUMNO }, 'administrador')).toEqual({
      ...reservaConvertida,
      alumno: ALUMNO,
    });
  });

  it('exige el alumno', () => {
    expect(() => aCrearClaseDto(reserva, 'administrador')).toThrow('El alumno es obligatorio');
  });
});

describe('aActualizarClaseDto', () => {
  it('acepta un solo campo y convierte la fecha a Date', () => {
    expect(aActualizarClaseDto({ inicio: reserva.inicio })).toEqual({ inicio: reservaConvertida.inicio });
  });

  it('deja en undefined la fecha que no se mandó: la completa el service', () => {
    const dto = aActualizarClaseDto({ fin: reserva.fin });

    expect(dto.inicio).toBeUndefined();
    expect(dto.fin).toEqual(reservaConvertida.fin);
  });

  it('sin fechas, no agrega ninguna', () => {
    const dto = aActualizarClaseDto({ profesor: reserva.profesor });

    expect(dto).toEqual({ profesor: reserva.profesor });
    expect(dto.inicio).toBeUndefined();
  });

  it('rechaza un fin que no es una fecha ISO con zona', () => {
    expect(() => aActualizarClaseDto({ fin: '2099-01-05T11:00:00' })).toThrow(`El fin ${MENSAJE_FECHA}`);
  });

  it.each([
    [{ alumno: ALUMNO }, 'alumno'],
    [{ estado: 'confirmada' }, 'estado'],
    [{ $set: { estado: 'confirmada' } }, '$set'],
  ])('rechaza campos que no se pueden modificar (%j)', (body, campo) => {
    expect(() => aActualizarClaseDto(body)).toThrow(`No se pueden modificar estos campos: ${campo}`);
  });

  it('rechaza un objeto vacío', () => {
    expect(() => aActualizarClaseDto({})).toThrow('Debe indicarse al menos un campo para actualizar');
  });

  it('rechaza un inicio que no es texto', () => {
    expect(() => aActualizarClaseDto({ inicio: 123 })).toThrow('El inicio debe ser un texto');
  });
});
