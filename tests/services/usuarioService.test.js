import mongoose from 'mongoose';
import { setupTestDB } from '../helpers/setupTestDB.js';
import ErrorMongooseObjIdInvalido from '../../src/errors/ErrorMongooseObjIdInvalido.js';
import * as usuarioService from '../../src/services/usuarioService.js';
import * as alumnoService from '../../src/services/alumnoService.js';
import * as administradorService from '../../src/services/administradorService.js';

setupTestDB();

describe('usuarioService', () => {
  describe('obtenerPorId', () => {
    it('debería devolver un usuario existente por su ID', async () => {
      const alumno = await alumnoService.crear({
        NomApe: 'Juan Perez',
        email: 'juan@email.com',
        password: 'password123',
      });

      const encontrado = await usuarioService.obtenerPorId(alumno._id.toString());

      expect(encontrado).not.toBeNull();
      expect(encontrado._id.toString()).toBe(alumno._id.toString());
      expect(encontrado.email).toBe('juan@email.com');
    });

    it('debería devolver null si el ID no existe', async () => {
      const idInexistente = new mongoose.Types.ObjectId().toString();

      const encontrado = await usuarioService.obtenerPorId(idInexistente);

      expect(encontrado).toBeNull();
    });

    it('debería lanzar ErrorMongooseObjIdInvalido si el formato del ID no es un ObjectId válido', async () => {
      await expect(
        usuarioService.obtenerPorId('id-invalido')
      ).rejects.toThrow(ErrorMongooseObjIdInvalido);
    });
  });

  describe('obtenerPorEmail', () => {
    it('debería devolver un usuario existente por su email (incluso con mayúsculas o espacios)', async () => {
      await administradorService.crear({
        NomApe: 'Ana Gomez',
        email: 'ana@escuela.com',
        password: 'password123',
      });

      const encontrado = await usuarioService.obtenerPorEmail('  ANA@Escuela.com ');

      expect(encontrado).not.toBeNull();
      expect(encontrado.NomApe).toBe('Ana Gomez');
      expect(encontrado.email).toBe('ana@escuela.com');
    });

    it('debería devolver null si el email no está registrado', async () => {
      const encontrado = await usuarioService.obtenerPorEmail('noexiste@email.com');

      expect(encontrado).toBeNull();
    });
  });
});
