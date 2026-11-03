import bcrypt from 'bcrypt';
import { setupTestDB } from '../helpers/setupTestDB.js';
import { ROLES } from '../../src/constants/roles.js';
import ErrorDeNegocio from '../../src/errors/ErrorDeNegocio.js';
import ErrorSaldoClasesInsuficiente from '../../src/errors/ErrorSaldoClasesInsuficiente.js';
import ErrorMongooseObjIdInvalido from '../../src/errors/ErrorMongooseObjIdInvalido.js';
import ErrorPasswordInvalida from '../../src/errors/ErrorPasswordInvalida.js';
import * as alumnoService from '../../src/services/alumnoService.js';
import * as administradorService from '../../src/services/administradorService.js';
import * as usuarioService from '../../src/services/usuarioService.js';

setupTestDB();

describe('alumnoService', () => {
  describe('crear', () => {
    it('debería crear un alumno válido con saldoClases en 0 por defecto, normalizar email y hashear contraseña', async () => {
      const creado = await alumnoService.crear({
        NomApe: 'Juan Perez',
        email: 'JUAN.PEREZ@Email.com',
        password: 'password123',
      });

      expect(creado._id).toBeDefined();
      expect(creado.NomApe).toBe('Juan Perez');
      expect(creado.email).toBe('juan.perez@email.com');
      expect(creado.rol).toBe(ROLES.ALUMNO);
      expect(creado.saldoClases).toBe(0);

      const enDb = await usuarioService.obtenerPorId(creado._id.toString());
      expect(enDb.password).not.toBe('password123');
      const coincideHash = await bcrypt.compare('password123', enDb.password);
      expect(coincideHash).toBe(true);
    });

    it('debería rechazar con ErrorPasswordInvalida si la contraseña tiene menos de 8 caracteres', async () => {
      await expect(
        alumnoService.crear({
          NomApe: 'Juan Perez',
          email: 'juan@email.com',
          password: '1234567',
        })
      ).rejects.toThrow(ErrorPasswordInvalida);
    });

    it('debería rechazar si el email no tiene un formato válido o ya está registrado', async () => {
      await expect(
        alumnoService.crear({
          NomApe: 'Juan Perez',
          email: 'email-invalido',
          password: 'password123',
        })
      ).rejects.toThrow();

      await alumnoService.crear({
        NomApe: 'Juan Perez',
        email: 'repetido@email.com',
        password: 'password123',
      });

      await expect(
        alumnoService.crear({
          NomApe: 'Otro Alumno',
          email: 'REPETIDO@email.com',
          password: 'password123',
        })
      ).rejects.toThrow();
    });

    it('debería rechazar si NomApe tiene menos de 4 o más de 50 caracteres', async () => {
      await expect(
        alumnoService.crear({
          NomApe: 'Sol',
          email: 'sol@email.com',
          password: 'password123',
        })
      ).rejects.toThrow();

      await expect(
        alumnoService.crear({
          NomApe: 'A'.repeat(51),
          email: 'largo@email.com',
          password: 'password123',
        })
      ).rejects.toThrow();
    });

    it('debería rechazar si saldoClases inicial es negativo o no entero', async () => {
      await expect(
        alumnoService.crear({
          NomApe: 'Juan Perez',
          email: 'negativo@email.com',
          password: 'password123',
          saldoClases: -1,
        })
      ).rejects.toThrow();

      await expect(
        alumnoService.crear({
          NomApe: 'Juan Perez',
          email: 'decimal@email.com',
          password: 'password123',
          saldoClases: 1.5,
        })
      ).rejects.toThrow();
    });
  });

  describe('listar', () => {
    it('debería listar únicamente a los alumnos y no a los administradores', async () => {
      await alumnoService.crear({
        NomApe: 'Alumno Uno',
        email: 'alumno1@email.com',
        password: 'password123',
      });

      await alumnoService.crear({
        NomApe: 'Alumno Dos',
        email: 'alumno2@email.com',
        password: 'password123',
      });

      await administradorService.crear({
        NomApe: 'Admin Uno',
        email: 'admin1@escuela.com',
        password: 'password123',
      });

      const lista = await alumnoService.listar();

      expect(lista).toHaveLength(2);
      expect(lista.every((u) => u.rol === ROLES.ALUMNO)).toBe(true);
    });
  });

  describe('obtenerPorId', () => {
    it('debería obtener un alumno existente por su ID', async () => {
      const alumno = await alumnoService.crear({
        NomApe: 'Juan Perez',
        email: 'juan@email.com',
        password: 'password123',
      });

      const encontrado = await alumnoService.obtenerPorId(alumno._id.toString());

      expect(encontrado).not.toBeNull();
      expect(encontrado.email).toBe('juan@email.com');
    });

    it('debería devolver null si el ID pertenece a un administrador o es inválido', async () => {
      const admin = await administradorService.crear({
        NomApe: 'Ana Gomez',
        email: 'ana@escuela.com',
        password: 'password123',
      });

      const porIdAdmin = await alumnoService.obtenerPorId(admin._id.toString());
      expect(porIdAdmin).toBeNull();

      await expect(
        alumnoService.obtenerPorId('id-invalido')
      ).rejects.toThrow(ErrorMongooseObjIdInvalido);
    });
  });

  describe('actualizar', () => {
    it('debería actualizar NomApe y email de un alumno', async () => {
      const alumno = await alumnoService.crear({
        NomApe: 'Carlos Ruiz',
        email: 'carlos@email.com',
        password: 'password123',
      });

      const actualizado = await alumnoService.actualizar(
        alumno._id.toString(),
        {
          NomApe: 'Carlos Alberto Ruiz',
          email: 'NUEVO.CARLOS@email.com',
        }
      );

      expect(actualizado.NomApe).toBe('Carlos Alberto Ruiz');
      expect(actualizado.email).toBe('nuevo.carlos@email.com');
    });

    it('debería hashear la nueva contraseña al actualizarla si tiene >= 8 caracteres', async () => {
      const alumno = await alumnoService.crear({
        NomApe: 'Laura Diaz',
        email: 'laura@email.com',
        password: 'passwordVieja1',
      });

      await alumnoService.actualizar(alumno._id.toString(), {
        password: 'passwordNueva2',
      });

      const enDb = await usuarioService.obtenerPorId(alumno._id.toString());
      expect(enDb.password).not.toBe('passwordNueva2');
      const coincide = await bcrypt.compare('passwordNueva2', enDb.password);
      expect(coincide).toBe(true);
    });

    it('debería rechazar con ErrorPasswordInvalida la actualización si la nueva contraseña tiene menos de 8 caracteres', async () => {
      const alumno = await alumnoService.crear({
        NomApe: 'Laura Diaz',
        email: 'laura@email.com',
        password: 'passwordValida123',
      });

      await expect(
        alumnoService.actualizar(alumno._id.toString(), {
          password: '1234567',
        })
      ).rejects.toThrow(ErrorPasswordInvalida);
    });

    it('debería rechazar la actualización si el nuevo email es inválido o ya está en uso', async () => {
      const a1 = await alumnoService.crear({
        NomApe: 'Alumno Uno',
        email: 'uno@email.com',
        password: 'password123',
      });

      const a2 = await alumnoService.crear({
        NomApe: 'Alumno Dos',
        email: 'dos@email.com',
        password: 'password123',
      });

      await expect(
        alumnoService.actualizar(a2._id.toString(), {
          email: 'formato-invalido',
        })
      ).rejects.toThrow();

      await expect(
        alumnoService.actualizar(a2._id.toString(), {
          email: a1.email,
        })
      ).rejects.toThrow();
    });
  });

  describe('sumarSaldoClases y restarSaldoClases', () => {
    it('debería sumar saldo de clases correctamente', async () => {
      const alumno = await alumnoService.crear({
        NomApe: 'Pedro Sosa',
        email: 'pedro@email.com',
        password: 'password123',
      });

      const actualizado = await alumnoService.sumarSaldoClases(
        alumno._id.toString(),
        { cantidad: 5 }
      );

      expect(actualizado.saldoClases).toBe(5);
    });

    it('debería restar saldo de clases cuando hay saldo suficiente', async () => {
      const alumno = await alumnoService.crear({
        NomApe: 'Pedro Sosa',
        email: 'pedro@email.com',
        password: 'password123',
        saldoClases: 5,
      });

      const actualizado = await alumnoService.restarSaldoClases(
        alumno._id.toString(),
        { cantidad: 2 }
      );

      expect(actualizado.saldoClases).toBe(3);
    });

    it('debería lanzar ErrorSaldoClasesInsuficiente al intentar restar más saldo del disponible', async () => {
      const alumno = await alumnoService.crear({
        NomApe: 'Pedro Sosa',
        email: 'pedro@email.com',
        password: 'password123',
        saldoClases: 2,
      });

      await expect(
        alumnoService.restarSaldoClases(alumno._id.toString(), { cantidad: 3 })
      ).rejects.toThrow(ErrorSaldoClasesInsuficiente);
    });

    it('debería rechazar con ErrorDeNegocio sumar o restar cantidades menores o iguales a 0 o decimales', async () => {
      const alumno = await alumnoService.crear({
        NomApe: 'Pedro Sosa',
        email: 'pedro@email.com',
        password: 'password123',
        saldoClases: 5,
      });

      await expect(
        alumnoService.sumarSaldoClases(alumno._id.toString(), { cantidad: 0 })
      ).rejects.toThrow(ErrorDeNegocio);

      await expect(
        alumnoService.sumarSaldoClases(alumno._id.toString(), { cantidad: -2 })
      ).rejects.toThrow(ErrorDeNegocio);

      await expect(
        alumnoService.restarSaldoClases(alumno._id.toString(), { cantidad: 1.5 })
      ).rejects.toThrow(ErrorDeNegocio);
    });
  });

  describe('Restricción de eliminación', () => {
    it('no debería exponer ninguna función para eliminar alumnos', async () => {
      expect(alumnoService.eliminar).toBeUndefined();
    });
  });
});
