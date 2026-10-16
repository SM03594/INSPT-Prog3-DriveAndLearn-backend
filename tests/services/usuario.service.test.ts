// ============================================================
//  usuario.service.test.ts — Tests de la CAPA SERVICE de Usuarios
// ============================================================
// usuario.service trabaja sobre la colección completa, así que los
// datos se cargan con los services de cada rol (alumno y
// administrador) y se verifica que vuelvan mezclados y con su tipo.

import { describe, it, expect } from 'vitest';
import { setupTestDB } from '../setupTestDB.js';
import {
  listar,
  obtenerPorId,
  obtenerPorEmail,
} from '../../src/services/usuario.service.js';
import { crear as crearAlumno } from '../../src/services/alumno.service.js';
import { crear as crearAdministrador } from '../../src/services/administrador.service.js';
import { AlumnoModel } from '../../src/models/Alumno.js';
import { AdministradorModel } from '../../src/models/Administrador.js';
import type { Alumno } from '../../src/models/Alumno.js';
import type { Administrador } from '../../src/models/Administrador.js';

// Registra los hooks (Mongo en memoria, limpiar entre tests, cerrar).
setupTestDB();

// Datos de ejemplo reutilizables.
const datosAlumno: Alumno = {
  email: 'ana@example.com',
  password: 'unHashDeBcrypt',
  nomApe: 'Ana Pérez',
  clasesPorReservar: 3,
};

const datosAdministrador: Administrador = {
  email: 'admin@example.com',
  password: 'unHashDeBcrypt',
  nomApe: 'Admin Root',
};

// Un ObjectId con forma válida pero que no existe en la base.
const ID_INEXISTENTE = '64b7f0f0f0f0f0f0f0f0f0f0';

describe('usuario.service', () => {
  // --------------------------------------------------------
  //  listar
  // --------------------------------------------------------
  describe('listar', () => {
    it('devuelve [] cuando no hay usuarios', async () => {
      expect(await listar()).toEqual([]);
    });

    it('devuelve alumnos y administradores juntos', async () => {
      await crearAlumno(datosAlumno);
      await crearAlumno({ ...datosAlumno, email: 'beto@example.com' });
      await crearAdministrador(datosAdministrador);

      const usuarios = await listar();

      expect(usuarios).toHaveLength(3);
      expect(usuarios.filter((u) => u.rol === 'alumno')).toHaveLength(2);
      expect(usuarios.filter((u) => u.rol === 'administrador')).toHaveLength(1);
    });

    it('hidrata cada documento con el modelo de su rol', async () => {
      await crearAlumno(datosAlumno);
      await crearAdministrador(datosAdministrador);

      const usuarios = await listar();
      const alumno = usuarios.find((u) => u.rol === 'alumno');
      const admin = usuarios.find((u) => u.rol === 'administrador');

      expect(alumno).toBeInstanceOf(AlumnoModel);
      expect(admin).toBeInstanceOf(AdministradorModel);
    });

    it('trae los campos propios del alumno (clasesPorReservar)', async () => {
      await crearAlumno(datosAlumno);

      const [usuario] = await listar();

      // El if achica el tipo a AlumnoDoc (ver UsuarioDoc en Usuario.ts).
      if (usuario?.rol !== 'alumno') throw new Error('Se esperaba un alumno');
      expect(usuario.clasesPorReservar).toBe(3);
    });

    it('no expone la password al serializar (toJSON)', async () => {
      await crearAlumno(datosAlumno);
      await crearAdministrador(datosAdministrador);

      for (const usuario of await listar()) {
        expect(usuario.toJSON()).not.toHaveProperty('password');
      }
    });
  });

  // --------------------------------------------------------
  //  obtenerPorId
  // --------------------------------------------------------
  describe('obtenerPorId', () => {
    it('devuelve un alumno con su rol y sus campos propios', async () => {
      const creado = await crearAlumno(datosAlumno);
      const encontrado = await obtenerPorId(creado._id.toString());

      expect(encontrado?._id.toString()).toBe(creado._id.toString());
      expect(encontrado?.rol).toBe('alumno');
      expect(encontrado).toBeInstanceOf(AlumnoModel);
    });

    it('devuelve un administrador con su rol', async () => {
      const creado = await crearAdministrador(datosAdministrador);
      const encontrado = await obtenerPorId(creado._id.toString());

      expect(encontrado?._id.toString()).toBe(creado._id.toString());
      expect(encontrado?.rol).toBe('administrador');
      expect(encontrado).toBeInstanceOf(AdministradorModel);
    });

    it('devuelve null si el id no existe', async () => {
      expect(await obtenerPorId(ID_INEXISTENTE)).toBeNull();
    });

    it('tira CastError si el id no tiene forma de ObjectId', async () => {
      await expect(obtenerPorId('no-es-un-objectid')).rejects.toThrow();
    });
  });

  // --------------------------------------------------------
  //  obtenerPorEmail
  // --------------------------------------------------------
  describe('obtenerPorEmail', () => {
    it('encuentra a un alumno por su email', async () => {
      const creado = await crearAlumno(datosAlumno);
      const encontrado = await obtenerPorEmail('ana@example.com');

      expect(encontrado?._id.toString()).toBe(creado._id.toString());
      expect(encontrado?.rol).toBe('alumno');
    });

    it('encuentra a un administrador por su email', async () => {
      const creado = await crearAdministrador(datosAdministrador);
      const encontrado = await obtenerPorEmail('admin@example.com');

      expect(encontrado?._id.toString()).toBe(creado._id.toString());
      expect(encontrado?.rol).toBe('administrador');
    });

    it('ignora mayúsculas y espacios alrededor del email', async () => {
      const creado = await crearAlumno(datosAlumno);
      const encontrado = await obtenerPorEmail('  ANA@Example.COM ');

      expect(encontrado?._id.toString()).toBe(creado._id.toString());
    });

    it('devuelve null si no hay usuario con ese email', async () => {
      await crearAlumno(datosAlumno);

      expect(await obtenerPorEmail('nadie@example.com')).toBeNull();
    });
  });
});
