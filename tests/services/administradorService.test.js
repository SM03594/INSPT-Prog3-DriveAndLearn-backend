import bcrypt from 'bcrypt';
import { setupTestDB } from '../helpers/setupTestDB.js';
import { ROLES } from '../../src/constants/roles.js';
import ErrorMongooseObjIdInvalido from '../../src/errors/ErrorMongooseObjIdInvalido.js';
import ErrorPasswordInvalida from '../../src/errors/ErrorPasswordInvalida.js';
import * as administradorService from '../../src/services/administradorService.js';
import * as alumnoService from '../../src/services/alumnoService.js';
import * as usuarioService from '../../src/services/usuarioService.js';

setupTestDB();

describe('administradorService', () => {
  describe('crear', () => {
    it('debería crear un administrador válido, normalizar el email y hashear la contraseña', async () => {
      const creado = await administradorService.crear({
        NomApe: 'Ana Gomez',
        email: 'ANA.GOMEZ@Escuela.com',
        password: 'password123',
      });

      expect(creado._id).toBeDefined();
      expect(creado.NomApe).toBe('Ana Gomez');
      expect(creado.email).toBe('ana.gomez@escuela.com');
      expect(creado.rol).toBe(ROLES.ADMINISTRADOR);

      const enDb = await usuarioService.obtenerPorId(creado._id.toString());
      expect(enDb.password).not.toBe('password123');
      const coincideHash = await bcrypt.compare('password123', enDb.password);
      expect(coincideHash).toBe(true);
    });

    it('debería rechazar con ErrorPasswordInvalida si la contraseña tiene menos de 8 caracteres', async () => {
      await expect(
        administradorService.crear({
          NomApe: 'Ana Gomez',
          email: 'ana@escuela.com',
          password: '1234567',
        })
      ).rejects.toThrow(ErrorPasswordInvalida);
    });

    it('debería rechazar si el email no tiene un formato válido', async () => {
      await expect(
        administradorService.crear({
          NomApe: 'Ana Gomez',
          email: 'email-invalido',
          password: 'password123',
        })
      ).rejects.toThrow();
    });

    it('debería rechazar si el email ya está registrado', async () => {
      await administradorService.crear({
        NomApe: 'Ana Gomez',
        email: 'repetido@escuela.com',
        password: 'password123',
      });

      await expect(
        administradorService.crear({
          NomApe: 'Otro Admin',
          email: 'REPETIDO@escuela.com',
          password: 'password123',
        })
      ).rejects.toThrow();
    });

    it('debería rechazar si NomApe tiene menos de 4 o más de 50 caracteres', async () => {
      await expect(
        administradorService.crear({
          NomApe: 'Ana',
          email: 'ana@escuela.com',
          password: 'password123',
        })
      ).rejects.toThrow();

      await expect(
        administradorService.crear({
          NomApe: 'A'.repeat(51),
          email: 'largo@escuela.com',
          password: 'password123',
        })
      ).rejects.toThrow();
    });
  });

  describe('listar', () => {
    it('debería listar únicamente a los administradores y no a los alumnos', async () => {
      await administradorService.crear({
        NomApe: 'Admin Uno',
        email: 'admin1@escuela.com',
        password: 'password123',
      });

      await administradorService.crear({
        NomApe: 'Admin Dos',
        email: 'admin2@escuela.com',
        password: 'password123',
      });

      await alumnoService.crear({
        NomApe: 'Alumno Uno',
        email: 'alumno1@email.com',
        password: 'password123',
      });

      const lista = await administradorService.listar();

      expect(lista).toHaveLength(2);
      expect(lista.every((u) => u.rol === ROLES.ADMINISTRADOR)).toBe(true);
    });
  });

  describe('obtenerPorId', () => {
    it('debería obtener un administrador existente por su ID', async () => {
      const admin = await administradorService.crear({
        NomApe: 'Admin Uno',
        email: 'admin1@escuela.com',
        password: 'password123',
      });

      const encontrado = await administradorService.obtenerPorId(
        admin._id.toString()
      );

      expect(encontrado).not.toBeNull();
      expect(encontrado.email).toBe('admin1@escuela.com');
    });

    it('debería devolver null si el ID pertenece a un alumno o no existe', async () => {
      const alumno = await alumnoService.crear({
        NomApe: 'Juan Perez',
        email: 'juan@email.com',
        password: 'password123',
      });

      const porIdAlumno = await administradorService.obtenerPorId(
        alumno._id.toString()
      );
      expect(porIdAlumno).toBeNull();

      await expect(
        administradorService.obtenerPorId('id-invalido')
      ).rejects.toThrow(ErrorMongooseObjIdInvalido);
    });
  });

  describe('actualizar', () => {
    it('debería actualizar NomApe y email de un administrador', async () => {
      const admin = await administradorService.crear({
        NomApe: 'Admin Original',
        email: 'original@escuela.com',
        password: 'password123',
      });

      const actualizado = await administradorService.actualizar(
        admin._id.toString(),
        {
          NomApe: 'Admin Modificado',
          email: 'NUEVO@escuela.com',
        }
      );

      expect(actualizado.NomApe).toBe('Admin Modificado');
      expect(actualizado.email).toBe('nuevo@escuela.com');
    });

    it('debería hashear la nueva contraseña al actualizarla si tiene >= 8 caracteres', async () => {
      const admin = await administradorService.crear({
        NomApe: 'Admin Uno',
        email: 'admin1@escuela.com',
        password: 'passwordVieja1',
      });

      await administradorService.actualizar(admin._id.toString(), {
        password: 'passwordNueva2',
      });

      const enDb = await usuarioService.obtenerPorId(admin._id.toString());
      expect(enDb.password).not.toBe('passwordNueva2');
      const coincide = await bcrypt.compare('passwordNueva2', enDb.password);
      expect(coincide).toBe(true);
    });

    it('debería rechazar con ErrorPasswordInvalida la actualización si la nueva contraseña tiene menos de 8 caracteres', async () => {
      const admin = await administradorService.crear({
        NomApe: 'Admin Uno',
        email: 'admin1@escuela.com',
        password: 'passwordValida123',
      });

      await expect(
        administradorService.actualizar(admin._id.toString(), {
          password: '1234567',
        })
      ).rejects.toThrow(ErrorPasswordInvalida);
    });

    it('debería rechazar la actualización si el nuevo email es inválido o ya está en uso', async () => {
      const admin1 = await administradorService.crear({
        NomApe: 'Admin Uno',
        email: 'admin1@escuela.com',
        password: 'password123',
      });

      const admin2 = await administradorService.crear({
        NomApe: 'Admin Dos',
        email: 'admin2@escuela.com',
        password: 'password123',
      });

      await expect(
        administradorService.actualizar(admin2._id.toString(), {
          email: 'email-malo',
        })
      ).rejects.toThrow();

      await expect(
        administradorService.actualizar(admin2._id.toString(), {
          email: admin1.email,
        })
      ).rejects.toThrow();
    });
  });

  describe('Restricción de eliminación', () => {
    it('no debería exponer ninguna función para eliminar administradores', async () => {
      expect(administradorService.eliminar).toBeUndefined();
    });
  });
});
