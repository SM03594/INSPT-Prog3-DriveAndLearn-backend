// ============================================================
//  validacionCampos.test.ts — Tests de src/utils/validacionCampos.ts (sin DB)
// ============================================================

import { describe, it, expect } from 'vitest';
import { exigido, validarCampos } from '../../src/utils/validacionCampos.js';
import { ErrorDeNegocio } from '../../src/errors/errorDeNegocio.js';
import { ErrorPeticionInvalida } from '../../src/errors/errorPeticionInvalida.js';

// Una tabla de prueba con los tres tipos de typeof.
const CAMPOS = {
  marca: { tipo: 'string', nombre: 'La marca' },
  anio: { tipo: 'number', nombre: 'El año' },
  activo: { tipo: 'boolean', nombre: 'El estado' },
} as const;

const AL_CREAR = { mensajeNoPermitidos: 'No se pueden enviar estos campos' };
const AL_ACTUALIZAR = { mensajeNoPermitidos: 'No se pueden modificar estos campos', alMenosUno: true };

describe('validarCampos', () => {
  it('devuelve un objeto nuevo con los campos permitidos', () => {
    const entrada = { marca: 'Fiat', anio: 2020, activo: false };

    const datos = validarCampos(entrada, CAMPOS, AL_CREAR);

    expect(datos).toEqual({ marca: 'Fiat', anio: 2020, activo: false });
    expect(datos).not.toBe(entrada);
  });

  // Un body que no es un objeto es un pedido mal armado, no una regla
  // de negocio: el mismo error que lanza cuerpoComoObjeto.
  it.each([null, [], 'texto', 3, undefined])('rechaza una entrada que no es un objeto (%j)', (entrada) => {
    const llamada = () => validarCampos(entrada, CAMPOS, AL_CREAR);

    expect(llamada).toThrow(ErrorPeticionInvalida);
    expect(llamada).toThrow('El cuerpo de la petición debe ser un objeto JSON');
  });

  it('rechaza los campos que no están en la tabla, y los nombra a todos', () => {
    expect(() =>
      validarCampos({ marca: 'Fiat', _id: 'x', createdAt: '2000-01-01' }, CAMPOS, AL_CREAR),
    ).toThrow('No se pueden enviar estos campos: _id, createdAt');
  });

  it.each([
    [{ $set: { activo: false } }, '$set'],
    [{ toString: 'x' }, 'toString'],
  ])('rechaza claves que no son campos (%j)', (entrada, clave) => {
    expect(() => validarCampos(entrada, CAMPOS, AL_ACTUALIZAR)).toThrow(
      `No se pueden modificar estos campos: ${clave}`,
    );
  });

  it.each([
    [{ marca: 123 }, 'La marca debe ser un texto'],
    [{ marca: null }, 'La marca debe ser un texto'],
    [{ anio: '2020' }, 'El año debe ser un número'],
    [{ activo: 'true' }, 'El estado debe ser verdadero o falso'],
  ])('toma el tipo de la tabla y rechaza %j', (entrada, mensaje) => {
    const llamada = () => validarCampos(entrada, CAMPOS, AL_CREAR);

    expect(llamada).toThrow(ErrorDeNegocio);
    expect(llamada).toThrow(mensaje);
  });

  it('con alMenosUno, rechaza un objeto vacío', () => {
    expect(() => validarCampos({}, CAMPOS, AL_ACTUALIZAR)).toThrow(
      'Debe indicarse al menos un campo para actualizar',
    );
  });

  it('sin alMenosUno, un objeto vacío devuelve {} (lo obligatorio lo exige cada DTO)', () => {
    expect(validarCampos({}, CAMPOS, AL_CREAR)).toEqual({});
  });

  it('agrega la ayuda del campo al mensaje, solo para los campos que la tienen', () => {
    const opciones = { ...AL_ACTUALIZAR, ayudaPorCampo: { saldo: 'usá sumar-clases' } };

    expect(() => validarCampos({ saldo: 1, color: 'rojo' }, CAMPOS, opciones)).toThrow(
      'No se pueden modificar estos campos: saldo, color (usá sumar-clases)',
    );
  });
});

describe('validarCampos con objeto, lista y cualquiera', () => {
  const CAMPOS_JSON = {
    tramo: { tipo: 'objeto', nombre: 'El tramo' },
    lunes: { tipo: 'lista', nombre: 'El lunes' },
    foto: { tipo: 'cualquiera', nombre: 'La foto' },
  } as const;

  it('acepta un objeto, una lista y cualquier valor en "cualquiera"', () => {
    const entrada = { tramo: { hora: 9 }, lunes: [], foto: 123 };

    expect(validarCampos(entrada, CAMPOS_JSON, AL_CREAR)).toEqual(entrada);
  });

  it.each([
    [{ tramo: 'mañana' }, 'El tramo debe ser un objeto'],
    [{ tramo: null }, 'El tramo debe ser un objeto'],
    [{ tramo: [] }, 'El tramo debe ser un objeto'],
    [{ lunes: {} }, 'El lunes debe ser una lista'],
    [{ lunes: 'x' }, 'El lunes debe ser una lista'],
  ])('rechaza %j', (entrada, mensaje) => {
    expect(() => validarCampos(entrada, CAMPOS_JSON, AL_CREAR)).toThrow(mensaje);
  });
});

describe('exigido', () => {
  it('devuelve el valor si vino, aunque sea falsy', () => {
    expect(exigido('x', 'Falta')).toBe('x');
    expect(exigido(false, 'Falta')).toBe(false);
    expect(exigido(0, 'Falta')).toBe(0);
    expect(exigido('', 'Falta')).toBe('');
  });

  it('lanza un ErrorDeNegocio con el mensaje si el valor es undefined', () => {
    const llamada = () => exigido(undefined, 'La patente es obligatoria');

    expect(llamada).toThrow(ErrorDeNegocio);
    expect(llamada).toThrow('La patente es obligatoria');
  });
});
