import mongoose from 'mongoose';
import { setupTestDB } from '../helpers/setupTestDB.js';
import ErrorDeNegocio from '../../src/errors/ErrorDeNegocio.js';
import ErrorFormatoDeFecha from '../../src/errors/ErrorFormatoDeFecha.js';
import ErrorPeticionInvalida from '../../src/errors/ErrorPeticionInvalida.js';
import ErrorRegistroInexistente from '../../src/errors/ErrorRegistroInexistente.js';
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

  describe('agregarDisponibilidad', () => {
    it('debería agregar múltiples tramos de disponibilidad en distintos días', async () => {
      const profesor = await profesorService.crear({
        NomApe: 'Roberto Sanchez',
      });

      const actualizado = await profesorService.agregarDisponibilidad(
        profesor._id.toString(),
        [
          {
            dia: 'lunes',
            tramoHorario: { horaInicio: '08:00', horaFin: '14:00' },
          },
          {
            dia: 'martes',
            tramoHorario: { horaInicio: '08:00', horaFin: '12:00' },
          },
          {
            dia: 'martes',
            tramoHorario: { horaInicio: '20:00', horaFin: '24:00' },
          },
        ]
      );

      expect(actualizado.disponibilidad.lunes).toMatchObject([
        { horaInicio: '08:00', horaFin: '14:00' },
      ]);
      expect(actualizado.disponibilidad.martes).toMatchObject([
        { horaInicio: '08:00', horaFin: '12:00' },
        { horaInicio: '20:00', horaFin: '24:00' },
      ]);
    });

    it('debería unificar tramos superpuestos en un mismo día (ej. 08:00-14:00 y 06:00-12:00 -> 06:00-14:00)', async () => {
      const profesor = await profesorService.crear({
        NomApe: 'Roberto Sanchez',
      });

      await profesorService.agregarDisponibilidad(profesor._id.toString(), [
        {
          dia: 'martes',
          tramoHorario: { horaInicio: '08:00', horaFin: '14:00' },
        },
      ]);

      const actualizado = await profesorService.agregarDisponibilidad(
        profesor._id.toString(),
        [
          {
            dia: 'martes',
            tramoHorario: { horaInicio: '06:00', horaFin: '12:00' },
          },
        ]
      );

      expect(actualizado.disponibilidad.martes).toMatchObject([
        { horaInicio: '06:00', horaFin: '14:00' },
      ]);
    });

    it('debería rechazar con ErrorFormatoDeFecha si las horas no son en punto (:00)', async () => {
      const profesor = await profesorService.crear({
        NomApe: 'Roberto Sanchez',
      });

      await expect(
        profesorService.agregarDisponibilidad(profesor._id.toString(), [
          {
            dia: 'lunes',
            tramoHorario: { horaInicio: '08:30', horaFin: '12:00' },
          },
        ])
      ).rejects.toThrow(ErrorFormatoDeFecha);
    });

    it('debería rechazar con ErrorDeNegocio si horaInicio es mayor o igual a horaFin', async () => {
      const profesor = await profesorService.crear({
        NomApe: 'Roberto Sanchez',
      });

      await expect(
        profesorService.agregarDisponibilidad(profesor._id.toString(), [
          {
            dia: 'lunes',
            tramoHorario: { horaInicio: '14:00', horaFin: '08:00' },
          },
        ])
      ).rejects.toThrow(ErrorDeNegocio);

      await expect(
        profesorService.agregarDisponibilidad(profesor._id.toString(), [
          {
            dia: 'lunes',
            tramoHorario: { horaInicio: '10:00', horaFin: '10:00' },
          },
        ])
      ).rejects.toThrow(ErrorDeNegocio);
    });

    it('debería rechazar con ErrorPeticionInvalida si el día es inválido o la lista está vacía', async () => {
      const profesor = await profesorService.crear({
        NomApe: 'Roberto Sanchez',
      });

      await expect(
        profesorService.agregarDisponibilidad(profesor._id.toString(), [])
      ).rejects.toThrow(ErrorPeticionInvalida);

      await expect(
        profesorService.agregarDisponibilidad(profesor._id.toString(), [
          {
            dia: 'feriado',
            tramoHorario: { horaInicio: '08:00', horaFin: '12:00' },
          },
        ])
      ).rejects.toThrow(ErrorPeticionInvalida);
    });

    it('debería lanzar ErrorRegistroInexistente si el profesor no existe y ErrorMongooseObjIdInvalido si el ID es inválido', async () => {
      const idInexistente = new mongoose.Types.ObjectId().toString();

      await expect(
        profesorService.agregarDisponibilidad(idInexistente, [
          {
            dia: 'lunes',
            tramoHorario: { horaInicio: '08:00', horaFin: '12:00' },
          },
        ])
      ).rejects.toThrow(ErrorRegistroInexistente);

      await expect(
        profesorService.agregarDisponibilidad('id-invalido', [
          {
            dia: 'lunes',
            tramoHorario: { horaInicio: '08:00', horaFin: '12:00' },
          },
        ])
      ).rejects.toThrow(ErrorMongooseObjIdInvalido);
    });
  });

  describe('quitarDisponibilidad', () => {
    it('debería dividir un tramo en dos al quitar una franja intermedia (ej. 08:00-14:00 menos 10:00-12:00 -> 08:00-10:00 y 12:00-14:00)', async () => {
      const profesor = await profesorService.crear({
        NomApe: 'Roberto Sanchez',
      });

      await profesorService.agregarDisponibilidad(profesor._id.toString(), [
        {
          dia: 'jueves',
          tramoHorario: { horaInicio: '08:00', horaFin: '14:00' },
        },
      ]);

      const actualizado = await profesorService.quitarDisponibilidad(
        profesor._id.toString(),
        [
          {
            dia: 'jueves',
            tramoHorario: { horaInicio: '10:00', horaFin: '12:00' },
          },
        ]
      );

      expect(actualizado.disponibilidad.jueves).toMatchObject([
        { horaInicio: '08:00', horaFin: '10:00' },
        { horaInicio: '12:00', horaFin: '14:00' },
      ]);
    });

    it('debería recortar extremos o eliminar por completo un tramo al quitar disponibilidad', async () => {
      const profesor = await profesorService.crear({
        NomApe: 'Roberto Sanchez',
      });

      await profesorService.agregarDisponibilidad(profesor._id.toString(), [
        {
          dia: 'lunes',
          tramoHorario: { horaInicio: '08:00', horaFin: '14:00' },
        },
        {
          dia: 'viernes',
          tramoHorario: { horaInicio: '10:00', horaFin: '16:00' },
        },
      ]);

      const actualizado = await profesorService.quitarDisponibilidad(
        profesor._id.toString(),
        [
          {
            dia: 'lunes',
            tramoHorario: { horaInicio: '08:00', horaFin: '14:00' },
          },
          {
            dia: 'viernes',
            tramoHorario: { horaInicio: '08:00', horaFin: '12:00' },
          },
        ]
      );

      expect(actualizado.disponibilidad.lunes).toEqual([]);
      expect(actualizado.disponibilidad.viernes).toMatchObject([
        { horaInicio: '12:00', horaFin: '16:00' },
      ]);
    });

    it('debería rechazar si los tramos a quitar tienen formato inválido o día inválido', async () => {
      const profesor = await profesorService.crear({
        NomApe: 'Roberto Sanchez',
      });

      await expect(
        profesorService.quitarDisponibilidad(profesor._id.toString(), [
          {
            dia: 'jueves',
            tramoHorario: { horaInicio: '10:15', horaFin: '12:00' },
          },
        ])
      ).rejects.toThrow(ErrorFormatoDeFecha);

      await expect(
        profesorService.quitarDisponibilidad(profesor._id.toString(), [
          {
            dia: 'diaInvalido',
            tramoHorario: { horaInicio: '10:00', horaFin: '12:00' },
          },
        ])
      ).rejects.toThrow(ErrorPeticionInvalida);
    });

    it('debería lanzar ErrorRegistroInexistente si el profesor no existe y ErrorMongooseObjIdInvalido si el ID es inválido', async () => {
      const idInexistente = new mongoose.Types.ObjectId().toString();

      await expect(
        profesorService.quitarDisponibilidad(idInexistente, [
          {
            dia: 'jueves',
            tramoHorario: { horaInicio: '10:00', horaFin: '12:00' },
          },
        ])
      ).rejects.toThrow(ErrorRegistroInexistente);

      await expect(
        profesorService.quitarDisponibilidad('id-invalido', [
          {
            dia: 'jueves',
            tramoHorario: { horaInicio: '10:00', horaFin: '12:00' },
          },
        ])
      ).rejects.toThrow(ErrorMongooseObjIdInvalido);
    });
  });

  describe('verDisponibilidad', () => {
    it('debería devolver la disponibilidad de un profesor existente por su ID', async () => {
      const profesor = await profesorService.crear({
        NomApe: 'Roberto Sanchez',
      });

      await profesorService.agregarDisponibilidad(profesor._id.toString(), [
        {
          dia: 'lunes',
          tramoHorario: { horaInicio: '08:00', horaFin: '14:00' },
        },
        {
          dia: 'miercoles',
          tramoHorario: { horaInicio: '16:00', horaFin: '20:00' },
        },
      ]);

      const disponibilidad = await profesorService.verDisponibilidad(
        profesor._id.toString()
      );

      expect(disponibilidad).toBeDefined();
      expect(disponibilidad.lunes).toMatchObject([
        { horaInicio: '08:00', horaFin: '14:00' },
      ]);
      expect(disponibilidad.miercoles).toMatchObject([
        { horaInicio: '16:00', horaFin: '20:00' },
      ]);
      expect(disponibilidad.martes).toEqual([]);
    });

    it('debería lanzar ErrorRegistroInexistente si el profesor no existe y ErrorMongooseObjIdInvalido si el ID es inválido', async () => {
      const idInexistente = new mongoose.Types.ObjectId().toString();

      await expect(
        profesorService.verDisponibilidad(idInexistente)
      ).rejects.toThrow(ErrorRegistroInexistente);

      await expect(
        profesorService.verDisponibilidad('id-invalido')
      ).rejects.toThrow(ErrorMongooseObjIdInvalido);
    });
  });
});
