// ============================================================
//  profesor.service.test.ts — Tests de la CAPA SERVICE de Profesores
// ============================================================

import { describe, it, expect } from 'vitest';
import { setupTestDB } from '../setupTestDB.js';
import {
  listar,
  obtenerPorId,
  cambiarNomApe,
  cambiarFotoPerfil,
  agregarDisponibilidad,
  quitarDisponibilidad,
} from '../../src/services/profesor.service.js';
import { ProfesorModel } from '../../src/models/Profesor.js';
import type { Horario } from '../../src/models/Horario.js';

// Registra los hooks (Mongo en memoria, limpiar entre tests, cerrar).
setupTestDB();

// Un ObjectId con forma válida pero que no existe en la base.
const ID_INEXISTENTE = '64b7f0f0f0f0f0f0f0f0f0f0';

// Intervalos de disponibilidad de ejemplo.
const LUNES: Horario = {
  dia: 'lunes',
  horaInicio: { hora: 9, minuto: 0 },
  horaFin: { hora: 12, minuto: 0 },
};
const MARTES: Horario = {
  dia: 'martes',
  horaInicio: { hora: 14, minuto: 0 },
  horaFin: { hora: 18, minuto: 0 },
};

// Helper: crea un profesor de prueba (con la disponibilidad que se le pase).
const crearProfesor = (disponibilidad: Horario[] = []) =>
  ProfesorModel.create({ nomApe: 'Juan Docente', disponibilidad });

describe('profesor.service', () => {
  // --------------------------------------------------------
  //  listar
  // --------------------------------------------------------
  describe('listar', () => {
    it('devuelve [] cuando no hay profesores', async () => {
      expect(await listar()).toEqual([]);
    });

    it('devuelve todos los profesores creados', async () => {
      await crearProfesor();
      await crearProfesor();
      await crearProfesor();

      expect(await listar()).toHaveLength(3);
    });
  });

  // --------------------------------------------------------
  //  obtenerPorId
  // --------------------------------------------------------
  describe('obtenerPorId', () => {
    it('devuelve el profesor pedido', async () => {
      const creado = await crearProfesor();
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
  //  cambiarNomApe
  // --------------------------------------------------------
  describe('cambiarNomApe', () => {
    it('cambia el nombre y apellido y devuelve el doc actualizado', async () => {
      const creado = await crearProfesor();

      const res = await cambiarNomApe(creado._id.toString(), 'Ana Instructora');

      expect(res?.nomApe).toBe('Ana Instructora');
    });

    it('devuelve null si el profesor no existe', async () => {
      expect(await cambiarNomApe(ID_INEXISTENTE, 'Nadie')).toBeNull();
    });

    it('tira ValidationError si el nombre y apellido es vacío (runValidators)', async () => {
      const creado = await crearProfesor();

      await expect(
        cambiarNomApe(creado._id.toString(), ''),
      ).rejects.toThrow(/nombre y apellido es obligatorio/);
    });
  });

  // --------------------------------------------------------
  //  cambiarFotoPerfil
  // --------------------------------------------------------
  describe('cambiarFotoPerfil', () => {
    it('guarda la foto y devuelve el doc actualizado', async () => {
      const creado = await crearProfesor();
      const foto = Buffer.from('bytes-de-una-imagen');

      const res = await cambiarFotoPerfil(creado._id.toString(), foto);

      expect(res?.fotoPerfil).toBeInstanceOf(Buffer);
      expect(res?.fotoPerfil?.toString()).toBe('bytes-de-una-imagen');
    });

    it('devuelve null si el profesor no existe', async () => {
      const foto = Buffer.from('x');
      expect(await cambiarFotoPerfil(ID_INEXISTENTE, foto)).toBeNull();
    });

    it('tira ValidationError si la foto supera el tamaño máximo (2 MiB)', async () => {
      const creado = await crearProfesor();
      const fotoEnorme = Buffer.alloc(2 * (Math.pow(1024, 2)) + 1); // 2 MiB + 1 byte

      await expect(
        cambiarFotoPerfil(creado._id.toString(), fotoEnorme),
      ).rejects.toThrow(/no puede superar/);
    });
  });

  // --------------------------------------------------------
  //  agregarDisponibilidad
  // --------------------------------------------------------
  describe('agregarDisponibilidad', () => {
    it('agrega un intervalo al array y devuelve el doc actualizado', async () => {
      const creado = await crearProfesor();

      const res = await agregarDisponibilidad(creado._id.toString(), LUNES);

      expect(res?.disponibilidad).toHaveLength(1);
      expect(res?.disponibilidad[0]?._id).toBeDefined(); // Mongoose le asigna un _id
      expect(res?.disponibilidad[0]?.dia).toBe('lunes');
      expect(res?.disponibilidad[0]?.horaInicio?.hora).toBe(9);
      expect(res?.disponibilidad[0]?.horaInicio?.minuto).toBe(0);
      expect(res?.disponibilidad[0]?.horaFin?.hora).toBe(12);
    });

    it('acumula intervalos (no pisa los que ya había)', async () => {
      const creado = await crearProfesor([LUNES]);

      const res = await agregarDisponibilidad(creado._id.toString(), MARTES);

      expect(res?.disponibilidad).toHaveLength(2);
      expect(res?.disponibilidad[1]?.dia).toBe('martes');
    });

    it('devuelve null si el profesor no existe', async () => {
      expect(await agregarDisponibilidad(ID_INEXISTENTE, LUNES)).toBeNull();
    });

    it('tira ValidationError si el intervalo tiene un día inválido', async () => {
      const creado = await crearProfesor();

      await expect(
        agregarDisponibilidad(creado._id.toString(), {
          ...LUNES,
          dia: 'algo' as Horario['dia'],
        }),
      ).rejects.toThrow(/día inválido/);
    });

    it('tira ValidationError si los minutos están fuera de rango', async () => {
      const creado = await crearProfesor();

      await expect(
        agregarDisponibilidad(creado._id.toString(), {
          ...LUNES,
          horaInicio: { hora: 9, minuto: 99 },
        }),
      ).rejects.toThrow(/entre 0 y 59/);
    });

    it('tira ValidationError si horaFin no es posterior a horaInicio', async () => {
      const creado = await crearProfesor();

      await expect(
        agregarDisponibilidad(creado._id.toString(), {
          dia: 'lunes',
          horaInicio: { hora: 12, minuto: 0 },
          horaFin: { hora: 9, minuto: 0 },
        }),
      ).rejects.toThrow(/posterior a la de inicio/);
    });
  });

  // --------------------------------------------------------
  //  quitarDisponibilidad
  // --------------------------------------------------------
  describe('quitarDisponibilidad', () => {
    it('quita el intervalo del id dado y devuelve el doc actualizado', async () => {
      const creado = await crearProfesor([LUNES, MARTES]);
      const horarioId = creado.disponibilidad[0]!._id!.toString();

      const res = await quitarDisponibilidad(creado._id.toString(), horarioId);

      expect(res?.disponibilidad).toHaveLength(1);
      expect(res?.disponibilidad[0]?.dia).toBe('martes');
    });

    it('devuelve null si el profesor no existe', async () => {
      expect(
        await quitarDisponibilidad(ID_INEXISTENTE, ID_INEXISTENTE),
      ).toBeNull();
    });

    it('devuelve null si el id de intervalo no existe', async () => {
      const creado = await crearProfesor([LUNES]);

      expect(
        await quitarDisponibilidad(creado._id.toString(), ID_INEXISTENTE),
      ).toBeNull();
    });
  });
});
