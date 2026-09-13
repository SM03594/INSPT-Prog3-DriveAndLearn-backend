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
import {
  listar,
  obtenerPorId,
  crear,
  actualizar,
  cancelar,
} from '../../src/services/clase.service.js';
import type { Clase } from '../../src/models/Clase.js';

setupTestDB();

const alumnoId = new Types.ObjectId();
const profesorId = new Types.ObjectId();
const autoId = new Types.ObjectId();

const datosValidos: Clase = {
  alumno: alumnoId,
  profesor: profesorId,
  auto: autoId,
  fecha: '2026-09-20',
  horaInicio: '09:00',
  horaFin: '10:00',
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
        fecha: '2026-09-21',
        horaInicio: '11:00',
        horaFin: '12:00',
      });

      expect(await listar()).toHaveLength(2);
    });

    it('tira ValidationError si falta la fecha', async () => {
      const { fecha: _omitida, ...sinFecha } = datosValidos;

      await expect(crear(sinFecha as Clase)).rejects.toThrow(/fecha/i);
    });

    it('tira ValidationError si falta el alumno', async () => {
      const { alumno: _omitido, ...sinAlumno } = datosValidos;

      await expect(crear(sinAlumno as Clase)).rejects.toThrow(/alumno/i);
    });

    it('tira ValidationError si falta el profesor', async () => {
      const { profesor: _omitido, ...sinProfesor } = datosValidos;

      await expect(crear(sinProfesor as Clase)).rejects.toThrow(/profesor/i);
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
        fecha: '2026-09-21',
        horaInicio: '14:00',
        horaFin: '15:00',
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
      expect(actualizada?.fecha).toBe('2026-09-20');
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
