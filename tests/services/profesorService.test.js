import mongoose from 'mongoose';
import { setupTestDB } from '../helpers/setupTestDB.js';
import ErrorDeNegocio from '../../src/errors/ErrorDeNegocio.js';
import ErrorMongooseObjIdInvalido from '../../src/errors/ErrorMongooseObjIdInvalido.js';
import * as profesorService from '../../src/services/profesorService.js';

setupTestDB();

describe('profesorService', () => {
  describe('crear', () => {
    it('debería crear un profesor válido con NomApe', async () => {
      const creado = await profesorService.crear({
        NomApe: '  Roberto Sanchez  ',
      });

      expect(creado._id).toBeDefined();
      expect(creado.NomApe).toBe('Roberto Sanchez');
    });

    it('debería rechazar si falta NomApe', async () => {
      await expect(profesorService.crear({})).rejects.toThrow();
    });

    it('debería rechazar si NomApe tiene menos de 4 o más de 50 caracteres', async () => {
      await expect(
        profesorService.crear({
          NomApe: 'Leo',
        })
      ).rejects.toThrow();

      await expect(
        profesorService.crear({
          NomApe: 'A'.repeat(51),
        })
      ).rejects.toThrow();
    });

    it('debería rechazar con ErrorDeNegocio si se intenta asignar disponibilidad al crear el profesor', async () => {
      await expect(
        profesorService.crear({
          NomApe: 'Roberto Sanchez',
          disponibilidad: {
            martes: [{ horaInicio: '10:00', horaFin: '15:00' }],
          },
        })
      ).rejects.toThrow(ErrorDeNegocio);
    });
  });

  describe('listar', () => {
    it('debería listar todos los profesores registrados', async () => {
      await profesorService.crear({ NomApe: 'Profesor Uno' });
      await profesorService.crear({ NomApe: 'Profesor Dos' });

      const lista = await profesorService.listar();

      expect(lista).toHaveLength(2);
    });
  });

  describe('obtenerPorId', () => {
    it('debería devolver un profesor existente por su ID', async () => {
      const creado = await profesorService.crear({
        NomApe: 'Roberto Sanchez',
      });

      const encontrado = await profesorService.obtenerPorId(
        creado._id.toString()
      );

      expect(encontrado).not.toBeNull();
      expect(encontrado.NomApe).toBe('Roberto Sanchez');
    });

    it('debería devolver null si el ID no existe y lanzar ErrorMongooseObjIdInvalido si el ID es inválido', async () => {
      const idInexistente = new mongoose.Types.ObjectId().toString();
      const encontrado = await profesorService.obtenerPorId(idInexistente);
      expect(encontrado).toBeNull();

      await expect(
        profesorService.obtenerPorId('id-invalido')
      ).rejects.toThrow(ErrorMongooseObjIdInvalido);
    });
  });

  describe('actualizar', () => {
    it('debería actualizar el NomApe de un profesor existente', async () => {
      const profesor = await profesorService.crear({
        NomApe: 'Roberto Sanchez',
      });

      const actualizado = await profesorService.actualizar(
        profesor._id.toString(),
        {
          NomApe: 'Roberto Carlos Sanchez',
        }
      );

      expect(actualizado.NomApe).toBe('Roberto Carlos Sanchez');
    });

    it('debería rechazar la actualización si el nuevo NomApe tiene menos de 4 o más de 50 caracteres', async () => {
      const profesor = await profesorService.crear({
        NomApe: 'Roberto Sanchez',
      });

      await expect(
        profesorService.actualizar(profesor._id.toString(), {
          NomApe: 'Bob',
        })
      ).rejects.toThrow();

      await expect(
        profesorService.actualizar(profesor._id.toString(), {
          NomApe: 'A'.repeat(51),
        })
      ).rejects.toThrow();
    });

    it('debería lanzar ErrorMongooseObjIdInvalido al actualizar con un ID inválido', async () => {
      await expect(
        profesorService.actualizar('id-invalido', {
          NomApe: 'Nombre Valido',
        })
      ).rejects.toThrow(ErrorMongooseObjIdInvalido);
    });

    it('debería rechazar con ErrorDeNegocio si se intenta modificar disponibilidad desde actualizar', async () => {
      const profesor = await profesorService.crear({
        NomApe: 'Roberto Sanchez',
      });

      await expect(
        profesorService.actualizar(profesor._id.toString(), {
          disponibilidad: {
            martes: [{ horaInicio: '10:00', horaFin: '15:00' }],
          },
        })
      ).rejects.toThrow(ErrorDeNegocio);
    });
  });
});
