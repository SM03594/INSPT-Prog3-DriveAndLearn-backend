import mongoose from 'mongoose';
import { vi } from 'vitest';
import { setupTestDB } from '../helpers/setupTestDB.js';
import ErrorDeNegocio from '../../src/errors/ErrorDeNegocio.js';
import ErrorFormatoDeFecha from '../../src/errors/ErrorFormatoDeFecha.js';
import ErrorPeticionInvalida from '../../src/errors/ErrorPeticionInvalida.js';
import ErrorRegistroInexistente from '../../src/errors/ErrorRegistroInexistente.js';
import ErrorMongooseObjIdInvalido from '../../src/errors/ErrorMongooseObjIdInvalido.js';
import * as profesorService from '../../src/services/profesorService.js';
import * as autoService from '../../src/services/autoService.js';
import * as alumnoService from '../../src/services/alumnoService.js';
import * as claseService from '../../src/services/claseService.js';
import { ROLES } from '../../src/constants/roles.js';

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

  describe('obtenerTurnosLibres', () => {
    let profesor;
    let autoManual;
    let autoAutomatico;
    let alumno;

    beforeEach(async () => {
      profesor = await profesorService.crear({ NomApe: 'Profesor Carlos' });
      await profesorService.agregarDisponibilidad(profesor._id.toString(), [
        {
          dia: 'martes',
          tramoHorario: { horaInicio: '10:00', horaFin: '13:00' },
        },
      ]);

      autoManual = await autoService.crear({
        marca: 'Ford',
        modelo: 'Ka',
        patente: 'AA111AA',
        cambios: 'MANUAL',
      });

      autoAutomatico = await autoService.crear({
        marca: 'Toyota',
        modelo: 'Corolla',
        patente: 'BB222BB',
        cambios: 'AUTOMATICO',
      });

      alumno = await alumnoService.crear({
        NomApe: 'Alumno Prueba',
        email: `alumno.${Date.now()}.${Math.random()}@test.com`,
        password: 'password123',
        saldoClases: 5,
      });
    });

    it('debería devolver turnos libres con todos los autos disponibles para un día futuro con disponibilidad', async () => {
      // 2026-11-10 es martes en el futuro
      const resultado = await profesorService.obtenerTurnosLibres({
        profesorId: profesor._id.toString(),
        fecha: '2026-11-10',
      });

      expect(resultado.turnos_libres).toHaveLength(3);
      expect(resultado.turnos_libres[0]).toMatchObject({
        inicio: '2026-11-10T10:00',
        fin: '2026-11-10T11:00',
      });
      expect(resultado.turnos_libres[0].autos).toHaveLength(2);
      expect(resultado.turnos_libres[1]).toMatchObject({
        inicio: '2026-11-10T11:00',
        fin: '2026-11-10T12:00',
      });
      expect(resultado.turnos_libres[2]).toMatchObject({
        inicio: '2026-11-10T12:00',
        fin: '2026-11-10T13:00',
      });
    });

    it('debería filtrar los autos disponibles si se indica cambios MANUAL o AUTOMATICO', async () => {
      const resManual = await profesorService.obtenerTurnosLibres({
        profesorId: profesor._id.toString(),
        fecha: '2026-11-10',
        cambios: 'manual',
      });

      expect(resManual.turnos_libres).toHaveLength(3);
      expect(resManual.turnos_libres[0].autos).toHaveLength(1);
      expect(resManual.turnos_libres[0].autos[0].cambios).toBe('MANUAL');

      const resAuto = await profesorService.obtenerTurnosLibres({
        profesorId: profesor._id.toString(),
        fecha: '2026-11-10',
        cambios: 'AUTOMATICO',
      });

      expect(resAuto.turnos_libres).toHaveLength(3);
      expect(resAuto.turnos_libres[0].autos).toHaveLength(1);
      expect(resAuto.turnos_libres[0].autos[0].cambios).toBe('AUTOMATICO');
    });

    it('debería excluir turnos en los que el profesor ya tiene una clase agendada', async () => {
      // Agendamos una clase para este profesor el martes 10 de 11:00 a 12:00
      await claseService.agendar(
        {
          alumno: alumno._id.toString(),
          profesor: profesor._id.toString(),
          auto: autoManual._id.toString(),
          inicio: '2026-11-10T11:00',
          fin: '2026-11-10T12:00',
        },
        { rol: ROLES.ALUMNO, id: alumno._id.toString() }
      );

      const resultado = await profesorService.obtenerTurnosLibres({
        profesorId: profesor._id.toString(),
        fecha: '2026-11-10',
      });

      // Se deben excluir las 11:00 -> quedan 10:00 y 12:00
      expect(resultado.turnos_libres).toHaveLength(2);
      expect(resultado.turnos_libres[0].inicio).toBe('2026-11-10T10:00');
      expect(resultado.turnos_libres[1].inicio).toBe('2026-11-10T12:00');
    });

    it('debería excluir un auto de un turno si está asignado a otra clase a esa misma hora con otro profesor', async () => {
      const otroProfesor = await profesorService.crear({ NomApe: 'Profesor Segundo' });
      await profesorService.agregarDisponibilidad(otroProfesor._id.toString(), [
        {
          dia: 'martes',
          tramoHorario: { horaInicio: '10:00', horaFin: '12:00' },
        },
      ]);

      // El otro profesor usa el autoManual de 10:00 a 11:00
      await claseService.agendar(
        {
          alumno: alumno._id.toString(),
          profesor: otroProfesor._id.toString(),
          auto: autoManual._id.toString(),
          inicio: '2026-11-10T10:00',
          fin: '2026-11-10T11:00',
        },
        { rol: ROLES.ALUMNO, id: alumno._id.toString() }
      );

      const resultado = await profesorService.obtenerTurnosLibres({
        profesorId: profesor._id.toString(),
        fecha: '2026-11-10',
      });

      // El turno de las 10:00 solo tiene autoAutomatico disponible
      const turno10 = resultado.turnos_libres.find((t) => t.inicio === '2026-11-10T10:00');
      expect(turno10.autos).toHaveLength(1);
      expect(turno10.autos[0]._id.toString()).toBe(autoAutomatico._id.toString());

      // El turno de las 12:00 tiene ambos autos
      const turno12 = resultado.turnos_libres.find((t) => t.inicio === '2026-11-10T12:00');
      expect(turno12.autos).toHaveLength(2);
    });

    it('debería incluir el turno con autos: [] si todos los autos están ocupados a esa hora (Opción B)', async () => {
      const otroProfesor = await profesorService.crear({ NomApe: 'Profesor Tercero' });
      await profesorService.agregarDisponibilidad(otroProfesor._id.toString(), [
        {
          dia: 'martes',
          tramoHorario: { horaInicio: '10:00', horaFin: '12:00' },
        },
      ]);

      const alumnoDos = await alumnoService.crear({
        NomApe: 'Alumno Dos',
        email: `alumno2.${Date.now()}.${Math.random()}@test.com`,
        password: 'password123',
        saldoClases: 5,
      });

      // Ocupamos autoManual a las 10:00 con otroProfesor
      await claseService.agendar(
        {
          alumno: alumno._id.toString(),
          profesor: otroProfesor._id.toString(),
          auto: autoManual._id.toString(),
          inicio: '2026-11-10T10:00',
          fin: '2026-11-10T11:00',
        },
        { rol: ROLES.ALUMNO, id: alumno._id.toString() }
      );

      // Creamos un cuarto profesor para ocupar el segundo auto a las 10:00
      const cuartoProfesor = await profesorService.crear({ NomApe: 'Profesor Cuarto' });
      await profesorService.agregarDisponibilidad(cuartoProfesor._id.toString(), [
        {
          dia: 'martes',
          tramoHorario: { horaInicio: '10:00', horaFin: '12:00' },
        },
      ]);

      await claseService.agendar(
        {
          alumno: alumnoDos._id.toString(),
          profesor: cuartoProfesor._id.toString(),
          auto: autoAutomatico._id.toString(),
          inicio: '2026-11-10T10:00',
          fin: '2026-11-10T11:00',
        },
        { rol: ROLES.ALUMNO, id: alumnoDos._id.toString() }
      );

      const resultado = await profesorService.obtenerTurnosLibres({
        profesorId: profesor._id.toString(),
        fecha: '2026-11-10',
      });

      // A las 10:00 el profesor está libre, pero autos está vacío []
      const turno10 = resultado.turnos_libres.find((t) => t.inicio === '2026-11-10T10:00');
      expect(turno10).toBeDefined();
      expect(turno10.autos).toEqual([]);
    });

    it('debería devolver turnos_libres: [] si el profesor no tiene disponibilidad configurada en ese día', async () => {
      // 2026-11-11 es miércoles (no tiene disponibilidad)
      const resultado = await profesorService.obtenerTurnosLibres({
        profesorId: profesor._id.toString(),
        fecha: '2026-11-11',
      });

      expect(resultado).toEqual({ turnos_libres: [] });
    });

    it('debería descartar turnos pasados si la fecha consultada es hoy', async () => {
      // Supongamos que hoy es 2026-11-10 (martes) a las 11:30 hora de Buenos Aires (14:30 UTC)
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-11-10T14:30:00Z'));

      try {
        const resultado = await profesorService.obtenerTurnosLibres({
          profesorId: profesor._id.toString(),
          fecha: '2026-11-10',
        });

        // 10:00 y 11:00 ya pasaron (o empezaron antes de las 11:30) -> solo queda 12:00 a 13:00
        expect(resultado.turnos_libres).toHaveLength(1);
        expect(resultado.turnos_libres[0].inicio).toBe('2026-11-10T12:00');
      } finally {
        vi.useRealTimers();
      }
    });

    it('debería lanzar ErrorMongooseObjIdInvalido si profesorId no es un ObjectId válido', async () => {
      await expect(
        profesorService.obtenerTurnosLibres({
          profesorId: 'invalido',
          fecha: '2026-11-10',
        })
      ).rejects.toThrow(ErrorMongooseObjIdInvalido);
    });

    it('debería lanzar ErrorRegistroInexistente si el profesor no existe', async () => {
      const idInexistente = new mongoose.Types.ObjectId().toString();

      await expect(
        profesorService.obtenerTurnosLibres({
          profesorId: idInexistente,
          fecha: '2026-11-10',
        })
      ).rejects.toThrow(ErrorRegistroInexistente);
    });

    it('debería lanzar ErrorPeticionInvalida si fecha no es provista o está vacía', async () => {
      await expect(
        profesorService.obtenerTurnosLibres({
          profesorId: profesor._id.toString(),
          fecha: '',
        })
      ).rejects.toThrow(ErrorPeticionInvalida);
    });

    it('debería lanzar ErrorFormatoDeFecha si la fecha no tiene formato YYYY-MM-DD o es inválida', async () => {
      await expect(
        profesorService.obtenerTurnosLibres({
          profesorId: profesor._id.toString(),
          fecha: '2026-14-03',
        })
      ).rejects.toThrow(ErrorFormatoDeFecha);

      await expect(
        profesorService.obtenerTurnosLibres({
          profesorId: profesor._id.toString(),
          fecha: '2026-02-30',
        })
      ).rejects.toThrow(ErrorFormatoDeFecha);
    });

    it('debería lanzar ErrorDeNegocio si la fecha es anterior a hoy', async () => {
      await expect(
        profesorService.obtenerTurnosLibres({
          profesorId: profesor._id.toString(),
          fecha: '2020-01-01',
        })
      ).rejects.toThrow(ErrorDeNegocio);
    });

    it('debería lanzar ErrorDeNegocio si cambios no es MANUAL ni AUTOMATICO', async () => {
      await expect(
        profesorService.obtenerTurnosLibres({
          profesorId: profesor._id.toString(),
          fecha: '2026-11-10',
          cambios: 'ELECTRICO',
        })
      ).rejects.toThrow(ErrorDeNegocio);
    });
  });
});
