// ============================================================
//  alumno.service.test.ts — Tests de la CAPA SERVICE de Alumnos
// ============================================================

import { describe, it, expect } from 'vitest';
import { setupTestDB } from '../setupTestDB.js';
import {
  listar,
  obtenerPorId,
  crear,
  actualizar,
  sumarClasesPorReservar,
  restarClasesPorReservar,
} from '../../src/services/alumno.service.js';
import type { AlumnoInterface } from '../../src/models/Alumno.js';

// Registra los hooks (Mongo en memoria, limpiar entre tests, cerrar).
setupTestDB();

// Datos de ejemplo reutilizables.
const datosValidos: AlumnoInterface = {
  email: 'ana@example.com',
  password: 'unHashDeBcrypt',
  nomApe: 'Ana Pérez',
  clasesPorReservar: 3,
};

// Un ObjectId con forma válida pero que no existe en la base.
const ID_INEXISTENTE = '64b7f0f0f0f0f0f0f0f0f0f0';

describe('alumno.service', () => {
  // --------------------------------------------------------
  //  crear
  // --------------------------------------------------------
  describe('crear', () => {
    it('guarda el alumno y le asigna un _id', async () => {
      const alumno = await crear(datosValidos);

      expect(alumno._id).toBeDefined();
      expect(alumno.email).toBe('ana@example.com');
      expect(alumno.nomApe).toBe('Ana Pérez');
    });

    it('normaliza el email a minúsculas (lowercase del esquema)', async () => {
      const alumno = await crear({ ...datosValidos, email: 'ANA@Example.COM' });
      expect(alumno.email).toBe('ana@example.com');
    });

    it('pone clasesPorReservar=0 por defecto si no se especifica', async () => {
      const { clasesPorReservar: _omitido, ...sinClases } = datosValidos;
      const alumno = await crear(sinClases as AlumnoInterface);

      expect(alumno.clasesPorReservar).toBe(0);
    });

    it('tira ValidationError si falta el email', async () => {
      const { email: _omitido, ...sinEmail } = datosValidos;

      await expect(crear(sinEmail as AlumnoInterface)).rejects.toThrow(
        /email es obligatorio/,
      );
    });

    it('tira ValidationError si falta la password', async () => {
      const { password: _omitido, ...sinPassword } = datosValidos;

      await expect(crear(sinPassword as AlumnoInterface)).rejects.toThrow(
        /contraseña es obligatoria/,
      );
    });

    it('tira ValidationError si clasesPorReservar es negativo (min: 0)', async () => {
      await expect(
        crear({ ...datosValidos, clasesPorReservar: -1 }),
      ).rejects.toThrow(/clasesPorReservar/);
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
    it('devuelve [] cuando no hay alumnos', async () => {
      expect(await listar()).toEqual([]);
    });

    it('devuelve todos los alumnos creados', async () => {
      await crear(datosValidos);
      await crear({ ...datosValidos, email: 'beto@example.com' });
      await crear({ ...datosValidos, email: 'caro@example.com' });

      expect(await listar()).toHaveLength(3);
    });
  });

  // --------------------------------------------------------
  //  obtenerPorId
  // --------------------------------------------------------
  describe('obtenerPorId', () => {
    it('devuelve el alumno pedido', async () => {
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
        nomApe: 'Ana Gómez',
      });

      expect(actualizado?.nomApe).toBe('Ana Gómez');
      expect(actualizado?.email).toBe('ana@example.com'); // intacto
    });

    it('devuelve null si el alumno no existe', async () => {
      expect(
        await actualizar(ID_INEXISTENTE, { nomApe: 'X' }),
      ).toBeNull();
    });

    it('tira ValidationError si se manda clasesPorReservar negativo (runValidators)', async () => {
      const creado = await crear(datosValidos);

      await expect(
        actualizar(creado._id.toString(), { clasesPorReservar: -5 }),
      ).rejects.toThrow(/clasesPorReservar/);
    });
  });

  // --------------------------------------------------------
  //  sumarClasesPorReservar  (le suma N clases al saldo actual)
  // --------------------------------------------------------
  // Espera una CANTIDAD a sumar (un delta), no el valor final:
  // si el alumno tenía 3 y sumás 2, queda con 5.
  describe('sumarClasesPorReservar', () => {
    it('suma la cantidad al saldo y devuelve el doc actualizado', async () => {
      const creado = await crear(datosValidos); // clasesPorReservar: 3

      const res = await sumarClasesPorReservar(creado._id.toString(), 2);

      expect(res?.clasesPorReservar).toBe(5);
    });

    it('devuelve null si el alumno no existe', async () => {
      expect(await sumarClasesPorReservar(ID_INEXISTENTE, 1)).toBeNull();
    });

    it('rechaza una cantidad negativa como argumento', async () => {
      const creado = await crear(datosValidos);

      await expect(
        sumarClasesPorReservar(creado._id.toString(), -2),
      ).rejects.toThrow(/cantidad/);
    });
  });

  // --------------------------------------------------------
  //  restarClasesPorReservar  (le resta N clases al saldo actual)
  // --------------------------------------------------------
  describe('restarClasesPorReservar', () => {
    it('resta la cantidad al saldo y devuelve el doc actualizado', async () => {
      const creado = await crear(datosValidos); // clasesPorReservar: 3

      const res = await restarClasesPorReservar(creado._id.toString(), 2);

      expect(res?.clasesPorReservar).toBe(1);
    });

    it('devuelve null si el alumno no existe', async () => {
      expect(await restarClasesPorReservar(ID_INEXISTENTE, 1)).toBeNull();
    });

    it('no deja el saldo por debajo de 0 (min: 0 del esquema)', async () => {
      const creado = await crear(datosValidos); // clasesPorReservar: 3

      await expect(
        restarClasesPorReservar(creado._id.toString(), 5),
      ).rejects.toThrow(/clasesPorReservar/);
    });
  });
});
