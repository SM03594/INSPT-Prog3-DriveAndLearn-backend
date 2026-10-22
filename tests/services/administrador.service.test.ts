// ============================================================
//  administrador.service.test.ts — Tests de la CAPA SERVICE de Administradores
// ============================================================


import { describe, it, expect } from 'vitest';
import { setupTestDB } from '../setupTestDB.js';
import {
  listar,
  obtenerPorId,
  existe,
  crear,
  actualizar,
} from '../../src/services/administrador.service.js';
import type { Administrador } from '../../src/models/Administrador.js';
import { crear as crearAlumno } from '../../src/services/alumno.service.js';
import { ErrorClaveDuplicada } from '../../src/errors/errorClaveDuplicada.js';

// Registra los hooks (Mongo en memoria, limpiar entre tests, cerrar).
setupTestDB();

// Datos de ejemplo reutilizables.
const datosValidos: Administrador = {
  email: 'admin@example.com',
  password: 'unHashDeBcrypt',
  nomApe: 'Admin Root',
};

// Un ObjectId con forma válida pero que no existe en la base.
const ID_INEXISTENTE = '64b7f0f0f0f0f0f0f0f0f0f0';

const MENSAJE_EMAIL_DUPLICADO = 'La direccion de email ya esta en uso.';

// Crea un alumno con ese email (el email es único entre TODOS los
// usuarios, no solo entre administradores).
function crearAlumnoCon(email: string) {
  return crearAlumno({
    email,
    password: 'unHashDeBcrypt',
    nomApe: 'Alumno',
  });
}

describe('administrador.service', () => {
  // --------------------------------------------------------
  //  crear
  // --------------------------------------------------------
  describe('crear', () => {
    it('guarda el administrador y le asigna un _id', async () => {
      const admin = await crear(datosValidos);

      expect(admin._id).toBeDefined();
      expect(admin.email).toBe('admin@example.com');
      expect(admin.nomApe).toBe('Admin Root');
    });

    it('guarda la contraseña hasheada, no en texto plano', async () => {
      const admin = await crear(datosValidos);

      expect(admin.password).not.toBe('unHashDeBcrypt');
      expect(admin.password).toMatch(/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/);
    });

    it('normaliza el email a minúsculas (lowercase del esquema)', async () => {
      const admin = await crear({ ...datosValidos, email: 'ADMIN@Example.COM' });
      expect(admin.email).toBe('admin@example.com');
    });

    it.each(['hola', 'admin@example', 'admin root@example.com'])(
      'tira ValidationError si el email no tiene formato válido (%s)',
      async (email) => {
        await expect(crear({ ...datosValidos, email })).rejects.toThrow(
          'El email no tiene un formato válido',
        );
      },
    );

    it('tira ValidationError si falta el email', async () => {
      const { email: _omitido, ...sinEmail } = datosValidos;

      await expect(crear(sinEmail as Administrador)).rejects.toThrow(
        /email es obligatorio/,
      );
    });

    it('tira ValidationError si falta la password', async () => {
      const { password: _omitido, ...sinPassword } = datosValidos;

      await expect(crear(sinPassword as Administrador)).rejects.toThrow(
        /contraseña es obligatoria/,
      );
    });

    it('tira ValidationError si falta el nombre y apellido', async () => {
      const { nomApe: _omitido, ...sinNomApe } = datosValidos;

      await expect(crear(sinNomApe as Administrador)).rejects.toThrow(
        /nombre y apellido es obligatorio/,
      );
    });

    it('tira ErrorClaveDuplicada (409) si el email ya existe', async () => {
      await crear(datosValidos);

      // crear() atrapa el error de Mongo/Mongoose y lo relanza como
      // ErrorClaveDuplicada (ver administrador.service.ts).
      const promesa = crear(datosValidos);
      await expect(promesa).rejects.toBeInstanceOf(ErrorClaveDuplicada);
      await expect(promesa).rejects.toMatchObject({ status: 409 });
      await expect(promesa).rejects.toThrow(MENSAJE_EMAIL_DUPLICADO);
    });

    it('tira ErrorClaveDuplicada aunque el email cambie de mayúsculas', async () => {
      await crear(datosValidos);

      await expect(
        crear({ ...datosValidos, email: 'ADMIN@Example.COM' }),
      ).rejects.toBeInstanceOf(ErrorClaveDuplicada);
    });

    it('tira ErrorClaveDuplicada si el email ya lo usa un alumno', async () => {
      await crearAlumnoCon('alumno@example.com');

      await expect(
        crear({ ...datosValidos, email: 'alumno@example.com' }),
      ).rejects.toBeInstanceOf(ErrorClaveDuplicada);
    });
  });

  // --------------------------------------------------------
  //  listar
  // --------------------------------------------------------
  describe('listar', () => {
    it('devuelve [] cuando no hay administradores', async () => {
      expect(await listar()).toEqual([]);
    });

    it('devuelve todos los administradores creados', async () => {
      await crear(datosValidos);
      await crear({ ...datosValidos, email: 'otro@example.com' });
      await crear({ ...datosValidos, email: 'tercero@example.com' });

      expect(await listar()).toHaveLength(3);
    });
  });

  // --------------------------------------------------------
  //  obtenerPorId
  // --------------------------------------------------------
  describe('obtenerPorId', () => {
    it('devuelve el administrador pedido', async () => {
      const creado = await crear(datosValidos);
      const encontrado = await obtenerPorId(creado._id.toString());

      expect(encontrado?._id.toString()).toBe(creado._id.toString());
    });

    it('devuelve null si el id no existe', async () => {
      expect(await obtenerPorId(ID_INEXISTENTE)).toBeNull();
    });

    it('tira CastError si el id no tiene forma de ObjectId', async () => {
      await expect(obtenerPorId('no-es-un-objectid')).rejects.toThrow();
    });
  });

  // --------------------------------------------------------
  //  existe
  // --------------------------------------------------------
  describe('existe', () => {
    it('devuelve true si el administrador existe', async () => {
      const creado = await crear(datosValidos);

      expect(await existe(creado._id.toString())).toBe(true);
    });

    it('devuelve false si el id no existe', async () => {
      expect(await existe(ID_INEXISTENTE)).toBe(false);
    });

    it('devuelve false para el id de un alumno', async () => {
      const alumno = await crearAlumnoCon('alumno@example.com');

      expect(await existe(alumno._id.toString())).toBe(false);
    });
  });

  // --------------------------------------------------------
  //  actualizar
  // --------------------------------------------------------
  describe('actualizar', () => {
    it('modifica solo los campos enviados y devuelve el doc actualizado', async () => {
      const creado = await crear(datosValidos);

      const actualizado = await actualizar(creado._id.toString(), {
        nomApe: 'Admin Editado',
      });

      expect(actualizado?.nomApe).toBe('Admin Editado');
      expect(actualizado?.email).toBe('admin@example.com'); // intacto
    });

    it('hashea la contraseña si se actualiza', async () => {
      const creado = await crear(datosValidos);

      const actualizado = await actualizar(creado._id.toString(), {
        password: 'nuevaPassword123',
      });

      expect(actualizado?.password).not.toBe('nuevaPassword123');
      expect(actualizado?.password).toMatch(/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/);
      expect(actualizado?.password).not.toBe(creado.password);
    });

    it('no toca la contraseña si no viene en los cambios', async () => {
      const creado = await crear(datosValidos);

      const actualizado = await actualizar(creado._id.toString(), {
        nomApe: 'Admin Editado',
      });

      expect(actualizado?.password).toBe(creado.password);
    });

    it('devuelve null si el administrador no existe', async () => {
      expect(
        await actualizar(ID_INEXISTENTE, { nomApe: 'X' }),
      ).toBeNull();
    });

    it('tira ValidationError si se manda un email vacío (runValidators)', async () => {
      const creado = await crear(datosValidos);

      await expect(
        actualizar(creado._id.toString(), { email: '' }),
      ).rejects.toThrow(/email es obligatorio/);
    });

    it('tira ValidationError si se manda un email sin formato válido (runValidators)', async () => {
      const creado = await crear(datosValidos);

      await expect(
        actualizar(creado._id.toString(), { email: 'hola' }),
      ).rejects.toThrow('El email no tiene un formato válido');
    });

    it('tira ErrorClaveDuplicada (409) si el email ya lo usa otro administrador', async () => {
      await crear(datosValidos);
      const otro = await crear({ ...datosValidos, email: 'otro@example.com' });

      const promesa = actualizar(otro._id.toString(), { email: datosValidos.email });
      await expect(promesa).rejects.toBeInstanceOf(ErrorClaveDuplicada);
      await expect(promesa).rejects.toMatchObject({ status: 409 });
      await expect(promesa).rejects.toThrow(MENSAJE_EMAIL_DUPLICADO);
    });

    it('tira ErrorClaveDuplicada si el email ya lo usa un alumno', async () => {
      const creado = await crear(datosValidos);
      await crearAlumnoCon('alumno@example.com');

      await expect(
        actualizar(creado._id.toString(), { email: 'alumno@example.com' }),
      ).rejects.toBeInstanceOf(ErrorClaveDuplicada);
    });
  });
});
