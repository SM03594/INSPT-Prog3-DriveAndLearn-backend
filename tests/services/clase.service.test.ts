// ============================================================
//  clase.service.test.ts — Tests de la CAPA SERVICE de Clases
// ============================================================
// Nota: este archivo asume un servicio de clases con las operaciones
// típicas del proyecto: listar, obtenerPorId, crear, actualizar y
// cancelar. Si tu diseño usa nombres distintos para los campos
// (por ejemplo alumnoId/profesorId/autoId), solo tenés que ajustar
// `datosValidos` y los imports del servicio/modelo.

import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { setupTestDB } from '../setupTestDB.js';
import { ErrorDeNegocio } from '../../src/errors/errorDeNegocio.js';
import {
  listar,
  obtenerPorId,
  crear,
  actualizar,
  cancelar,
} from '../../src/services/clase.service.js';
import type { DatosClase } from '../../src/services/clase.service.js';

setupTestDB();

const alumnoId = new Types.ObjectId();
const profesorId = new Types.ObjectId();
const autoId = new Types.ObjectId();

const datosValidos: DatosClase = {
  alumno: alumnoId,
  profesor: profesorId,
  auto: autoId,
  // Como llega del body: string ISO con offset de Argentina.
  inicio: '2026-09-20T09:00:00-03:00',
  fin: '2026-09-20T10:00:00-03:00',
  estado: 'pendiente',
};

const ID_INEXISTENTE = '64b7f0f0f0f0f0f0f0f0f0f0';

describe('clase.service', () => {
  describe('crear', () => {
    it('guarda la clase y le asigna un _id', async () => {
      const clase = await crear(datosValidos);

      expect(clase._id).toBeDefined();
      expect(clase.alumno.toString()).toBe(alumnoId.toString());
      expect(clase.profesor.toString()).toBe(profesorId.toString());
    });

    it('lista todas las clases creadas', async () => {
      await crear(datosValidos);
      await crear({
        ...datosValidos,
        inicio: '2026-09-21T11:00:00-03:00',
        fin: '2026-09-21T12:00:00-03:00',
      });

      expect(await listar()).toHaveLength(2);
    });

    it('guarda el instante en UTC respetando el offset enviado', async () => {
      const clase = await crear(datosValidos);

      // 09:00 en Argentina (-03:00) son las 12:00 UTC.
      expect(clase.inicio.toISOString()).toBe('2026-09-20T12:00:00.000Z');
    });

    it('acepta también un Date', async () => {
      const inicio = new Date('2026-09-20T12:00:00Z');
      const clase = await crear({
        ...datosValidos,
        inicio,
        fin: new Date('2026-09-20T13:00:00Z'),
      });

      expect(clase.inicio.toISOString()).toBe(inicio.toISOString());
    });

    it('tira ValidationError si falta el inicio', async () => {
      const { inicio: _omitido, ...sinInicio } = datosValidos;

      await expect(crear(sinInicio as DatosClase)).rejects.toThrow(/inicio/i);
    });

    it('tira ValidationError si falta el fin', async () => {
      const { fin: _omitido, ...sinFin } = datosValidos;

      await expect(crear(sinFin as DatosClase)).rejects.toThrow(/fin/i);
    });

    it('tira ErrorDeNegocio si el inicio no tiene zona horaria', async () => {
      await expect(
        crear({ ...datosValidos, inicio: '2026-09-20T09:00:00' }),
      ).rejects.toThrow(ErrorDeNegocio);
    });

    it('tira ErrorDeNegocio si el inicio no es una fecha', async () => {
      await expect(
        crear({ ...datosValidos, inicio: 'no-es-una-fecha' }),
      ).rejects.toThrow(/inicio/i);
    });

    it('tira ValidationError si el fin no es posterior al inicio', async () => {
      await expect(
        crear({ ...datosValidos, fin: datosValidos.inicio }),
      ).rejects.toThrow(/posterior al inicio/i);
    });

    it('tira ValidationError si falta el alumno', async () => {
      const { alumno: _omitido, ...sinAlumno } = datosValidos;

      await expect(crear(sinAlumno as DatosClase)).rejects.toThrow(/alumno/i);
    });

    it('tira ValidationError si falta el profesor', async () => {
      const { profesor: _omitido, ...sinProfesor } = datosValidos;

      await expect(crear(sinProfesor as DatosClase)).rejects.toThrow(/profesor/i);
    });
  });

  describe('listar', () => {
    it('devuelve [] cuando no hay clases', async () => {
      expect(await listar()).toEqual([]);
    });

    it('devuelve todas las clases creadas', async () => {
      await crear(datosValidos);
      await crear({
        ...datosValidos,
        inicio: '2026-09-21T14:00:00-03:00',
        fin: '2026-09-21T15:00:00-03:00',
      });

      expect(await listar()).toHaveLength(2);
    });
  });

  describe('obtenerPorId', () => {
    it('devuelve la clase pedida', async () => {
      const creada = await crear(datosValidos);
      const encontrada = await obtenerPorId(creada._id.toString());

      expect(encontrada?._id.toString()).toBe(creada._id.toString());
    });

    it('devuelve null si la clase no existe', async () => {
      expect(await obtenerPorId(ID_INEXISTENTE)).toBeNull();
    });

    it('tira CastError si el id no tiene forma válida', async () => {
      await expect(obtenerPorId('no-es-un-objectid')).rejects.toThrow();
    });
  });

  describe('actualizar', () => {
    it('modifica solo los campos enviados y devuelve el doc actualizado', async () => {
      const creada = await crear(datosValidos);

      const actualizada = await actualizar(creada._id.toString(), {
        estado: 'confirmada',
      });

      expect(actualizada?.estado).toBe('confirmada');
      expect(actualizada?.inicio.toISOString()).toBe('2026-09-20T12:00:00.000Z');
    });

    it('parsea inicio/fin si vienen en los cambios', async () => {
      const creada = await crear(datosValidos);

      const actualizada = await actualizar(creada._id.toString(), {
        inicio: '2026-09-20T10:00:00-03:00',
        fin: '2026-09-20T11:00:00-03:00',
      });

      expect(actualizada?.inicio.toISOString()).toBe('2026-09-20T13:00:00.000Z');
    });

    it('tira ErrorDeNegocio si el fin nuevo no tiene zona horaria', async () => {
      const creada = await crear(datosValidos);

      await expect(
        actualizar(creada._id.toString(), { fin: '2026-09-20T11:00' }),
      ).rejects.toThrow(ErrorDeNegocio);
    });

    it('devuelve null si la clase no existe', async () => {
      expect(await actualizar(ID_INEXISTENTE, { estado: 'cancelada' })).toBeNull();
    });
  });

  describe('cancelar', () => {
    it('cambia el estado a cancelada y devuelve la clase actualizada', async () => {
      const creada = await crear(datosValidos);

      const cancelada = await cancelar(creada._id.toString());

      expect(cancelada?.estado).toBe('cancelada');
    });

    it('devuelve null si la clase no existe', async () => {
      expect(await cancelar(ID_INEXISTENTE)).toBeNull();
    });
  });
});
