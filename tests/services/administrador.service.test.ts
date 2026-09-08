// ============================================================
//  administrador.service.test.ts — Tests de la CAPA SERVICE de Administradores
// ============================================================


import { describe, it, expect } from 'vitest';
import { setupTestDB } from '../setupTestDB.js';
import {
  listar,
  obtenerPorId,
  crear,
  actualizar,
} from '../../src/services/administrador.service.js';
import type { AdministradorInterface } from '../../src/models/Administrador.js';

// Registra los hooks (Mongo en memoria, limpiar entre tests, cerrar).
setupTestDB();

// Datos de ejemplo reutilizables.
const datosValidos: AdministradorInterface = {
  email: 'admin@example.com',
  password: 'unHashDeBcrypt',
  nomApe: 'Admin Root',
};

// Un ObjectId con forma válida pero que no existe en la base.
const ID_INEXISTENTE = '64b7f0f0f0f0f0f0f0f0f0f0';

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

    it('normaliza el email a minúsculas (lowercase del esquema)', async () => {
      const admin = await crear({ ...datosValidos, email: 'ADMIN@Example.COM' });
      expect(admin.email).toBe('admin@example.com');
    });

    it('tira ValidationError si falta el email', async () => {
      const { email: _omitido, ...sinEmail } = datosValidos;

      await expect(crear(sinEmail as AdministradorInterface)).rejects.toThrow(
        /email es obligatorio/,
      );
    });

    it('tira ValidationError si falta la password', async () => {
      const { password: _omitido, ...sinPassword } = datosValidos;

      await expect(crear(sinPassword as AdministradorInterface)).rejects.toThrow(
        /contraseña es obligatoria/,
      );
    });

    it('tira ValidationError si falta el nombre y apellido', async () => {
      const { nomApe: _omitido, ...sinNomApe } = datosValidos;

      await expect(crear(sinNomApe as AdministradorInterface)).rejects.toThrow(
        /nombre y apellido es obligatorio/,
      );
    });

    it('tira error de clave duplicada (11000) si el email ya existe', async () => {
      await crear(datosValidos);

      await expect(crear(datosValidos)).rejects.toMatchObject({ code: 11000 });
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
  });
});
