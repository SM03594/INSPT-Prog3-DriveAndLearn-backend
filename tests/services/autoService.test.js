import mongoose from 'mongoose';
import { setupTestDB } from '../helpers/setupTestDB.js';
import { CAMBIOS } from '../../src/constants/cambios.js';
import ErrorDeNegocio from '../../src/errors/ErrorDeNegocio.js';
import ErrorMongooseObjIdInvalido from '../../src/errors/ErrorMongooseObjIdInvalido.js';
import * as autoService from '../../src/services/autoService.js';

setupTestDB();

describe('autoService', () => {
  describe('crear', () => {
    it('debería crear un auto válido con patente tradicional o Mercosur, normalizando a mayúsculas y activo en true por defecto', async () => {
      const autoTradicional = await autoService.crear({
        marca: 'Volkswagen',
        modelo: 'Gol Trend',
        patente: 'abc123',
        cambios: 'manual',
      });

      expect(autoTradicional._id).toBeDefined();
      expect(autoTradicional.marca).toBe('Volkswagen');
      expect(autoTradicional.modelo).toBe('Gol Trend');
      expect(autoTradicional.patente).toBe('ABC123');
      expect(autoTradicional.cambios).toBe(CAMBIOS.MANUAL);
      expect(autoTradicional.activo).toBe(true);

      const autoMercosur = await autoService.crear({
        marca: 'Toyota',
        modelo: 'Etios',
        patente: 'ab123cd',
        cambios: 'automatico',
      });

      expect(autoMercosur.patente).toBe('AB123CD');
      expect(autoMercosur.cambios).toBe(CAMBIOS.AUTOMATICO);
    });

    it('debería rechazar si la patente no respeta ninguno de los dos formatos argentinos', async () => {
      await expect(
        autoService.crear({
          marca: 'Fiat',
          modelo: 'Cronos',
          patente: '123ABC',
          cambios: CAMBIOS.MANUAL,
        })
      ).rejects.toThrow();

      await expect(
        autoService.crear({
          marca: 'Fiat',
          modelo: 'Cronos',
          patente: 'ABCD123',
          cambios: CAMBIOS.MANUAL,
        })
      ).rejects.toThrow();
    });

    it('debería rechazar si la patente ya está registrada', async () => {
      await autoService.crear({
        marca: 'Volkswagen',
        modelo: 'Gol',
        patente: 'AB123CD',
        cambios: CAMBIOS.MANUAL,
      });

      await expect(
        autoService.crear({
          marca: 'Renault',
          modelo: 'Sandero',
          patente: 'ab123cd',
          cambios: CAMBIOS.AUTOMATICO,
        })
      ).rejects.toThrow();
    });

    it('debería rechazar si el tipo de cambios no es MANUAL ni AUTOMATICO', async () => {
      await expect(
        autoService.crear({
          marca: 'Peugeot',
          modelo: '208',
          patente: 'AB999CD',
          cambios: 'SECUENCIAL',
        })
      ).rejects.toThrow();
    });

    it('debería rechazar si falta marca, modelo, patente o cambios', async () => {
      await expect(
        autoService.crear({
          modelo: 'Gol',
          patente: 'ABC123',
          cambios: CAMBIOS.MANUAL,
        })
      ).rejects.toThrow();

      await expect(
        autoService.crear({
          marca: 'Volkswagen',
          patente: 'ABC123',
          cambios: CAMBIOS.MANUAL,
        })
      ).rejects.toThrow();
    });
  });

  describe('listar y listarActivos', () => {
    it('debería listar todos los autos registrados (activos e inactivos)', async () => {
      await autoService.crear({
        marca: 'Volkswagen',
        modelo: 'Gol',
        patente: 'ABC123',
        cambios: CAMBIOS.MANUAL,
      });

      await autoService.crear({
        marca: 'Toyota',
        modelo: 'Yaris',
        patente: 'AB123CD',
        cambios: CAMBIOS.AUTOMATICO,
        activo: false,
      });

      const lista = await autoService.listar();

      expect(lista).toHaveLength(2);
    });

    it('debería listar solo los autos activos cuando no se especifica tipo de cambios', async () => {
      await autoService.crear({
        marca: 'Volkswagen',
        modelo: 'Gol',
        patente: 'ABC123',
        cambios: CAMBIOS.MANUAL,
        activo: true,
      });

      await autoService.crear({
        marca: 'Toyota',
        modelo: 'Etios',
        patente: 'AB123CD',
        cambios: CAMBIOS.AUTOMATICO,
        activo: true,
      });

      await autoService.crear({
        marca: 'Fiat',
        modelo: 'Cronos',
        patente: 'AD456EF',
        cambios: CAMBIOS.MANUAL,
        activo: false,
      });

      const activos = await autoService.listarActivos();

      expect(activos).toHaveLength(2);
      expect(activos.every((auto) => auto.activo === true)).toBe(true);
    });

    it('debería filtrar los autos activos por tipo de cambios (MANUAL o AUTOMATICO)', async () => {
      await autoService.crear({
        marca: 'Volkswagen',
        modelo: 'Gol',
        patente: 'ABC123',
        cambios: CAMBIOS.MANUAL,
        activo: true,
      });

      await autoService.crear({
        marca: 'Toyota',
        modelo: 'Etios',
        patente: 'AB123CD',
        cambios: CAMBIOS.AUTOMATICO,
        activo: true,
      });

      await autoService.crear({
        marca: 'Peugeot',
        modelo: '208',
        patente: 'AE789FG',
        cambios: CAMBIOS.AUTOMATICO,
        activo: false,
      });

      const manualesActivos = await autoService.listarActivos(CAMBIOS.MANUAL);
      expect(manualesActivos).toHaveLength(1);
      expect(manualesActivos[0].patente).toBe('ABC123');

      const automaticosActivos = await autoService.listarActivos('automatico');
      expect(automaticosActivos).toHaveLength(1);
      expect(automaticosActivos[0].patente).toBe('AB123CD');
    });

    it('debería lanzar ErrorDeNegocio si se filtra activos con un tipo de cambios inválido', async () => {
      await expect(
        autoService.listarActivos('SECUENCIAL')
      ).rejects.toThrow(ErrorDeNegocio);
    });
  });

  describe('obtenerPorId', () => {
    it('debería devolver un auto existente por su ID', async () => {
      const creado = await autoService.crear({
        marca: 'Volkswagen',
        modelo: 'Gol',
        patente: 'ABC123',
        cambios: CAMBIOS.MANUAL,
      });

      const encontrado = await autoService.obtenerPorId(creado._id.toString());

      expect(encontrado).not.toBeNull();
      expect(encontrado.patente).toBe('ABC123');
    });

    it('debería devolver null si el ID no existe y lanzar ErrorMongooseObjIdInvalido si el ID es inválido', async () => {
      const idInexistente = new mongoose.Types.ObjectId().toString();
      const encontrado = await autoService.obtenerPorId(idInexistente);
      expect(encontrado).toBeNull();

      await expect(autoService.obtenerPorId('id-invalido')).rejects.toThrow(
        ErrorMongooseObjIdInvalido
      );
    });
  });

  describe('actualizar', () => {
    it('debería actualizar marca, modelo, patente, cambios y estado activo de un auto', async () => {
      const auto = await autoService.crear({
        marca: 'Volkswagen',
        modelo: 'Gol',
        patente: 'ABC123',
        cambios: CAMBIOS.MANUAL,
      });

      const actualizado = await autoService.actualizar(auto._id.toString(), {
        modelo: 'Gol Trend',
        patente: 'ab555cd',
        cambios: CAMBIOS.AUTOMATICO,
        activo: false,
      });

      expect(actualizado.modelo).toBe('Gol Trend');
      expect(actualizado.patente).toBe('AB555CD');
      expect(actualizado.cambios).toBe(CAMBIOS.AUTOMATICO);
      expect(actualizado.activo).toBe(false);
    });

    it('debería rechazar la actualización si la nueva patente es inválida o ya pertenece a otro auto', async () => {
      const auto1 = await autoService.crear({
        marca: 'Volkswagen',
        modelo: 'Gol',
        patente: 'ABC123',
        cambios: CAMBIOS.MANUAL,
      });

      const auto2 = await autoService.crear({
        marca: 'Toyota',
        modelo: 'Etios',
        patente: 'AB123CD',
        cambios: CAMBIOS.AUTOMATICO,
      });

      await expect(
        autoService.actualizar(auto2._id.toString(), {
          patente: 'PATENTE-MALA',
        })
      ).rejects.toThrow();

      await expect(
        autoService.actualizar(auto2._id.toString(), {
          patente: auto1.patente,
        })
      ).rejects.toThrow();
    });
  });
});
