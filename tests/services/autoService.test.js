import mongoose from 'mongoose';
import { setupTestDB } from '../helpers/setupTestDB.js';
import { CAMBIOS } from '../../src/constants/cambios.js';
import ErrorDeNegocio from '../../src/errors/ErrorDeNegocio.js';
import ErrorMongooseObjIdInvalido from '../../src/errors/ErrorMongooseObjIdInvalido.js';
import Clase from '../../src/models/Clase.js';
import * as autoService from '../../src/services/autoService.js';

setupTestDB();

describe('autoService', () => {
  describe('crear', () => {
    it('debería crear un auto válido con patente tradicional o Mercosur normalizando a mayúsculas', async () => {
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

  describe('listar', () => {
    it('debería listar todos los autos registrados cuando no se especifica tipo de cambios', async () => {
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
      });

      const lista = await autoService.listar();

      expect(lista).toHaveLength(2);
    });

    it('debería filtrar los autos por tipo de cambios (MANUAL o AUTOMATICO)', async () => {
      await autoService.crear({
        marca: 'Volkswagen',
        modelo: 'Gol',
        patente: 'ABC123',
        cambios: CAMBIOS.MANUAL,
      });

      await autoService.crear({
        marca: 'Toyota',
        modelo: 'Etios',
        patente: 'AB123CD',
        cambios: CAMBIOS.AUTOMATICO,
      });

      const manuales = await autoService.listar(CAMBIOS.MANUAL);
      expect(manuales).toHaveLength(1);
      expect(manuales[0].patente).toBe('ABC123');

      const automaticos = await autoService.listar('automatico');
      expect(automaticos).toHaveLength(1);
      expect(automaticos[0].patente).toBe('AB123CD');
    });

    it('debería lanzar ErrorDeNegocio si se filtra con un tipo de cambios inválido', async () => {
      await expect(autoService.listar('SECUENCIAL')).rejects.toThrow(
        ErrorDeNegocio
      );
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
    it('debería actualizar marca, modelo, patente y cambios de un auto', async () => {
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
      });

      expect(actualizado.modelo).toBe('Gol Trend');
      expect(actualizado.patente).toBe('AB555CD');
      expect(actualizado.cambios).toBe(CAMBIOS.AUTOMATICO);
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

  describe('obtenerAutosLibresEnTurno', () => {
    it('debería retornar todos los autos de la flota si no hay clases agendadas en ese turno', async () => {
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

      const autosLibres = await autoService.obtenerAutosLibresEnTurno(
        '2026-11-10T10:00'
      );

      expect(autosLibres).toHaveLength(2);
      expect(autosLibres.map((a) => a.patente)).toContain('ABC123');
      expect(autosLibres.map((a) => a.patente)).toContain('AB123CD');
    });

    it('debería excluir los autos ocupados en ese turno si tienen una clase agendada', async () => {
      const autoLibre = await autoService.crear({
        marca: 'Peugeot',
        modelo: '208',
        patente: 'AA111BB',
        cambios: CAMBIOS.MANUAL,
      });
      const autoOcupado = await autoService.crear({
        marca: 'Renault',
        modelo: 'Clio',
        patente: 'CC222DD',
        cambios: CAMBIOS.MANUAL,
      });

      const dummyProfesorId = new mongoose.Types.ObjectId();
      const dummyAlumnoId = new mongoose.Types.ObjectId();

      await Clase.create({
        alumno: dummyAlumnoId,
        profesor: dummyProfesorId,
        auto: autoOcupado._id,
        inicio: '2026-11-10T10:00',
        fin: '2026-11-10T11:00',
      });

      const autosLibres = await autoService.obtenerAutosLibresEnTurno(
        '2026-11-10T10:00'
      );

      expect(autosLibres).toHaveLength(1);
      expect(autosLibres[0]._id.toString()).toBe(autoLibre._id.toString());
    });

    it('debería filtrar por tipo de cambios cuando se especifica', async () => {
      await autoService.crear({
        marca: 'Volkswagen',
        modelo: 'Gol',
        patente: 'AE123FG',
        cambios: CAMBIOS.MANUAL,
      });
      await autoService.crear({
        marca: 'Toyota',
        modelo: 'Corolla',
        patente: 'AF456GH',
        cambios: CAMBIOS.AUTOMATICO,
      });

      const autosManuales = await autoService.obtenerAutosLibresEnTurno(
        '2026-11-10T10:00',
        'manual'
      );

      expect(autosManuales).toHaveLength(1);
      expect(autosManuales[0].cambios).toBe(CAMBIOS.MANUAL);

      const autosAutomaticos = await autoService.obtenerAutosLibresEnTurno(
        '2026-11-10T10:00',
        'AUTOMATICO'
      );

      expect(autosAutomaticos).toHaveLength(1);
      expect(autosAutomaticos[0].cambios).toBe(CAMBIOS.AUTOMATICO);
    });

    it('debería rechazar si cambios no es MANUAL ni AUTOMATICO', async () => {
      await expect(
        autoService.obtenerAutosLibresEnTurno('2026-11-10T10:00', 'ELECTRICO')
      ).rejects.toThrow(ErrorDeNegocio);
    });
  });

  describe('adjuntarAutosATurnos', () => {
    it('debería adjuntar los autos disponibles para cada turno recibido', async () => {
      const auto = await autoService.crear({
        marca: 'Volkswagen',
        modelo: 'Gol',
        patente: 'AB123CD',
        cambios: CAMBIOS.MANUAL,
      });

      const turnos = [
        { inicio: '2026-11-10T10:00', fin: '2026-11-10T11:00' },
        { inicio: '2026-11-10T11:00', fin: '2026-11-10T12:00' },
      ];

      const resultado = await autoService.adjuntarAutosATurnos(turnos);

      expect(resultado).toHaveLength(2);
      expect(resultado[0].inicio).toBe('2026-11-10T10:00');
      expect(resultado[0].autos).toHaveLength(1);
      expect(resultado[0].autos[0]._id.toString()).toBe(auto._id.toString());
      expect(resultado[1].inicio).toBe('2026-11-10T11:00');
      expect(resultado[1].autos).toHaveLength(1);
    });

    it('debería filtrar por tipo de cambios en todos los turnos', async () => {
      await autoService.crear({
        marca: 'Volkswagen',
        modelo: 'Gol',
        patente: 'AC123EF',
        cambios: CAMBIOS.MANUAL,
      });
      await autoService.crear({
        marca: 'Toyota',
        modelo: 'Etios',
        patente: 'AD456GH',
        cambios: CAMBIOS.AUTOMATICO,
      });

      const turnos = [
        { inicio: '2026-11-10T10:00', fin: '2026-11-10T11:00' },
      ];

      const resultado = await autoService.adjuntarAutosATurnos(
        turnos,
        'AUTOMATICO'
      );

      expect(resultado[0].autos).toHaveLength(1);
      expect(resultado[0].autos[0].cambios).toBe(CAMBIOS.AUTOMATICO);
    });
  });
});
