import { beforeEach, describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { setupTestDB } from '../setupTestDB.js';
import { ErrorDeNegocio } from '../../src/errors/errorDeNegocio.js';
import { AlumnoModel } from '../../src/models/Alumno.js';
import { AdministradorModel } from '../../src/models/Administrador.js';
import { ClaseModel } from '../../src/models/Clase.js';
import { AutoModel } from '../../src/models/Auto.js';
import { ProfesorModel } from '../../src/models/Profesor.js';
import { HorarioEscuelaModel } from '../../src/models/HorarioEscuela.js';
import {
  DIAS,
  crearCalendarioSemanal,
  type CalendarioSemanal,
} from '../../src/models/CalendarioSemanal.js';
import { aHoraLocal } from '../../src/utils/fechas.js';
import {
  listar,
  obtenerPorId,
  crear,
  actualizar,
  eliminar,
  obtenerPorIdAlumno,
  listarSuperpuestas,
  empiezaEnPunto,
} from '../../src/services/clase.service.js';
import type { CrearClaseDto } from '../../src/dtos/clase.dto.js';
import type { Actor } from '../../src/types/actor.js';

setupTestDB();

const actor: Actor = { id: '', rol: 'alumno' };
const actorAdministrador: Actor = { id: '', rol: 'administrador' };
let alumnoId: Types.ObjectId;
let otroAlumnoId: Types.ObjectId;
let profesorId: Types.ObjectId;
let profesorAlternativoId: Types.ObjectId;
let autoId: Types.ObjectId;
let autoAlternativoId: Types.ObjectId;
let administradorId: Types.ObjectId;
let inicioBase: Date;
let datosValidos: CrearClaseDto;

function proximoLunes(): Date {
  const fecha = new Date();
  fecha.setUTCHours(12, 0, 0, 0);
  do {
    fecha.setUTCDate(fecha.getUTCDate() + 1);
  } while (aHoraLocal(fecha).dia !== 'lunes');
  return fecha;
}

function calendarioConHorario(horaInicio: number, horaFin: number): CalendarioSemanal {
  const calendario = crearCalendarioSemanal();
  calendario.lunes.push({
    horaInicio: { hora: horaInicio, minuto: 0 },
    horaFin: { hora: horaFin, minuto: 0 },
  });
  return calendario;
}

function calendarioEscuela(): CalendarioSemanal {
  const calendario = crearCalendarioSemanal();
  for (const dia of DIAS) {
    calendario[dia].push({
      horaInicio: { hora: 8, minuto: 0 },
      horaFin: { hora: 18, minuto: 0 },
    });
  }
  return calendario;
}

beforeEach(async () => {
  alumnoId = new Types.ObjectId();
  otroAlumnoId = new Types.ObjectId();
  profesorId = new Types.ObjectId();
  profesorAlternativoId = new Types.ObjectId();
  autoId = new Types.ObjectId();
  autoAlternativoId = new Types.ObjectId();
  administradorId = new Types.ObjectId();
  actor.id = alumnoId.toString();
  actorAdministrador.id = administradorId.toString();

  inicioBase = proximoLunes();
  const finBase = new Date(inicioBase.getTime() + 60 * 60 * 1000);

  await AlumnoModel.create([
    {
      _id: alumnoId,
      email: 'alumno@example.com',
      password: 'hash',
      nomApe: 'Alumno',
      clasesPorReservar: 2,
    },
    {
      _id: otroAlumnoId,
      email: 'otro@example.com',
      password: 'hash',
      nomApe: 'Otro alumno',
      clasesPorReservar: 2,
    },
  ]);
  await AdministradorModel.create({
    _id: administradorId,
    email: 'admin@example.com',
    password: 'hash',
    nomApe: 'Admin',
  });
  await ProfesorModel.create([
    {
      _id: profesorId,
      nomApe: 'Profesor',
      disponibilidad: calendarioConHorario(9, 17),
    },
    {
      _id: profesorAlternativoId,
      nomApe: 'Profesor alternativo',
      disponibilidad: calendarioConHorario(9, 17),
    },
  ]);
  await AutoModel.create([
    { _id: autoId, patente: 'AA000AA', cambios: 'MANUAL', activo: true },
    { _id: autoAlternativoId, patente: 'BB000BB', cambios: 'AUTOMATICO', activo: true },
  ]);
  await HorarioEscuelaModel.create({
    _id: 'escuela',
    calendario: calendarioEscuela(),
  });

  datosValidos = {
    profesor: profesorId.toString(),
    auto: autoId.toString(),
    inicio: inicioBase,
    fin: finBase,
  };
});

describe('clase.service', () => {
  it('reserva una hora, descuenta un crédito y persiste la clase', async () => {
    const clase = await crear(datosValidos, actor);
    const alumno = await AlumnoModel.findById(alumnoId);

    expect(clase._id).toBeDefined();
    expect(clase.alumno.toString()).toBe(alumnoId.toString());
    expect(alumno?.clasesPorReservar).toBe(1);
  });

  it('permite a un administrador reservar para un alumno', async () => {
    const clase = await crear(
      { ...datosValidos, alumno: otroAlumnoId.toString() },
      actorAdministrador,
    );
    expect(clase.alumno.toString()).toBe(otroAlumnoId.toString());
  });

  it('rechaza intervalos que no duran exactamente una hora', async () => {
    await expect(
      crear({ ...datosValidos, fin: new Date(inicioBase.getTime() + 30 * 60 * 1000) }, actor),
    ).rejects.toThrow(/exactamente una hora/i);
  });

  it('rechaza una clase que no empieza en una hora en punto (09:20–10:20)', async () => {
    const inicio = new Date(inicioBase.getTime() + 20 * 60 * 1000);

    await expect(
      crear({ ...datosValidos, inicio, fin: new Date(inicio.getTime() + 60 * 60 * 1000) }, actor),
    ).rejects.toThrow('La clase debe empezar en una hora en punto (por ejemplo, 08:00)');
  });

  it('rechaza una clase con segundos, con el mismo mensaje de hora en punto', async () => {
    const inicio = new Date(inicioBase.getTime() + 30 * 1000);

    await expect(
      crear({ ...datosValidos, inicio, fin: new Date(inicio.getTime() + 60 * 60 * 1000) }, actor),
    ).rejects.toThrow(/hora en punto/);
  });

  it('empiezaEnPunto mira la hora de la escuela', () => {
    expect(empiezaEnPunto(inicioBase)).toBe(true);
    expect(empiezaEnPunto(new Date(inicioBase.getTime() + 30 * 60 * 1000))).toBe(false);
  });

  it('rechaza reservas pasadas y fuera del horario escolar', async () => {
    await expect(
      crear({
        ...datosValidos,
        inicio: new Date('2020-09-20T12:00:00.000Z'),
        fin: new Date('2020-09-20T13:00:00.000Z'),
      }, actor),
    ).rejects.toThrow(/fecha futura/i);

    await expect(
      crear({
        ...datosValidos,
        inicio: new Date(inicioBase.getTime() + 11 * 60 * 60 * 1000),
        fin: new Date(inicioBase.getTime() + 12 * 60 * 60 * 1000),
      }, actor),
    ).rejects.toThrow(/horario de la escuela/i);
  });

  it('rechaza clases fuera de disponibilidad o con el auto fuera de servicio', async () => {
    const domingo = new Date(inicioBase.getTime() + 6 * 24 * 60 * 60 * 1000);
    await expect(
      crear({
        ...datosValidos,
        inicio: domingo,
        fin: new Date(domingo.getTime() + 60 * 60 * 1000),
      }, actor),
    ).rejects.toThrow(/profesor no está disponible/i);

    await AutoModel.findByIdAndUpdate(autoId, { activo: false });
    await expect(crear(datosValidos, actor)).rejects.toThrow(/auto no está disponible/i);
  });

  it('rechaza si no hay créditos o si profesor/auto ya están ocupados', async () => {
    await AlumnoModel.findByIdAndUpdate(alumnoId, { clasesPorReservar: 0 });
    await expect(crear(datosValidos, actor)).rejects.toThrow(
      'No tenés clases disponibles para reservar',
    );

    await AlumnoModel.findByIdAndUpdate(alumnoId, { clasesPorReservar: 2 });
    await crear(datosValidos, actor);
    await expect(crear({
      ...datosValidos,
      alumno: otroAlumnoId.toString(),
    }, actorAdministrador)).rejects.toThrow(/ya tiene una clase/i);
  });

  it('a un admin que reserva para un alumno sin saldo le habla del alumno', async () => {
    await AlumnoModel.findByIdAndUpdate(otroAlumnoId, { clasesPorReservar: 0 });

    await expect(
      crear({ ...datosValidos, alumno: otroAlumnoId.toString() }, actorAdministrador),
    ).rejects.toThrow('El alumno no tiene clases disponibles para reservar');
  });

  it('no permite que un alumno reserve dos clases superpuestas con recursos diferentes', async () => {
    await crear(datosValidos, actor);
    await expect(
      crear({
        ...datosValidos,
        profesor: profesorAlternativoId.toString(),
        auto: autoAlternativoId.toString(),
      }, actor),
    ).rejects.toThrow(/alumno, profesor o auto/i);
  });

  it('filtra el listado y oculta las clases de otros alumnos', async () => {
    const clase = await crear(datosValidos, actor);
    expect(await listar(actor)).toHaveLength(1);
    const otroActor = {
      id: otroAlumnoId.toString(),
      rol: 'alumno',
    } as const;
    expect(await obtenerPorId(clase._id.toString(), otroActor)).toBeNull();
    expect(await actualizar(clase._id.toString(), { profesor: profesorAlternativoId.toString() }, otroActor)).toBeNull();
    expect(await eliminar(clase._id.toString(), otroActor)).toBeNull();
    expect(await ClaseModel.findById(clase._id)).not.toBeNull();
    expect(await listar(actorAdministrador)).toHaveLength(1);
  });

  it('reprograma una reserva validando disponibilidad y conserva su crédito', async () => {
    const clase = await crear(datosValidos, actor);
    const nuevaInicio = new Date(inicioBase.getTime() + 2 * 60 * 60 * 1000);
    const actualizada = await actualizar(
      clase._id.toString(),
      { inicio: nuevaInicio, profesor: profesorAlternativoId.toString() },
      actor,
    );
    const alumno = await AlumnoModel.findById(alumnoId);

    expect(actualizada?.inicio.toISOString()).toBe(nuevaInicio.toISOString());
    expect(actualizada?.fin.toISOString()).toBe(
      new Date(nuevaInicio.getTime() + 60 * 60 * 1000).toISOString(),
    );
    expect(alumno?.clasesPorReservar).toBe(1);
  });

  it('no permite reprogramar una clase a una hora que no es en punto', async () => {
    const clase = await crear(datosValidos, actor);

    await expect(
      actualizar(
        clase._id.toString(),
        { inicio: new Date(inicioBase.getTime() + 90 * 60 * 1000) },
        actor,
      ),
    ).rejects.toThrow(/hora en punto/);
  });

  // --------------------------------------------------------
  //  listarSuperpuestas
  // --------------------------------------------------------
  it('listarSuperpuestas trae las clases del profesor, del alumno o de los autos que pisan el período', async () => {
    const hora = 60 * 60 * 1000;
    // 09–10: el alumno con el profesor y el auto principal
    const delProfesor = await crear(datosValidos, actor);
    // 10–11: el otro alumno con el profesor alternativo y el otro auto
    const delOtroAuto = await crear({
      profesor: profesorAlternativoId.toString(),
      auto: autoAlternativoId.toString(),
      inicio: new Date(inicioBase.getTime() + hora),
      fin: new Date(inicioBase.getTime() + 2 * hora),
    }, { id: otroAlumnoId.toString(), rol: 'alumno' });

    const periodo = { inicio: inicioBase, fin: new Date(inicioBase.getTime() + 3 * hora) };
    const ids = (clases: { _id: Types.ObjectId }[]) => clases.map((c) => c._id.toString()).sort();

    // Solo el profesor principal y ningún auto: la de 10–11 no es suya.
    expect(ids(await listarSuperpuestas({
      ...periodo, profesor: profesorId.toString(), autos: [],
    }))).toEqual([delProfesor._id.toString()]);

    // Sumando el otro auto, aparece también la de 10–11.
    expect(ids(await listarSuperpuestas({
      ...periodo, profesor: profesorId.toString(), autos: [autoAlternativoId.toString()],
    }))).toEqual(ids([delProfesor, delOtroAuto]));

    // Por alumno: el otro alumno tiene la de 10–11.
    expect(ids(await listarSuperpuestas({
      ...periodo, profesor: new Types.ObjectId().toString(), alumno: otroAlumnoId.toString(), autos: [],
    }))).toEqual([delOtroAuto._id.toString()]);

    // Un período que termina justo cuando empieza la clase no la pisa.
    expect(await listarSuperpuestas({
      inicio: new Date(inicioBase.getTime() - hora), fin: inicioBase,
      profesor: profesorId.toString(), autos: [],
    })).toHaveLength(0);
  });

  // --------------------------------------------------------
  //  eliminar
  // --------------------------------------------------------
  it('elimina una clase futura y le devuelve el crédito al alumno', async () => {
    const clase = await crear(datosValidos, actor);

    expect(await eliminar(clase._id.toString(), actor)).not.toBeNull();

    expect(await ClaseModel.findById(clase._id)).toBeNull();
    expect((await AlumnoModel.findById(alumnoId))?.clasesPorReservar).toBe(2);
  });

  it('eliminar dos veces devuelve null la segunda y no reintegra de nuevo', async () => {
    const clase = await crear(datosValidos, actor);
    await eliminar(clase._id.toString(), actor);

    expect(await eliminar(clase._id.toString(), actor)).toBeNull();
    expect((await AlumnoModel.findById(alumnoId))?.clasesPorReservar).toBe(2);
  });

  it.each([
    ['ya ocurrió', -24 * 60 * 60 * 1000],
    ['está en curso', -10 * 60 * 1000],
  ])('elimina una clase que %s sin devolver el crédito', async (_caso, desfaseMs) => {
    const inicio = new Date(Date.now() + desfaseMs);
    const clase = await ClaseModel.create({
      alumno: alumnoId,
      profesor: profesorId,
      auto: autoId,
      inicio,
      fin: new Date(inicio.getTime() + 60 * 60 * 1000),
    });

    expect(await eliminar(clase._id.toString(), actor)).not.toBeNull();

    expect(await ClaseModel.findById(clase._id)).toBeNull();
    expect((await AlumnoModel.findById(alumnoId))?.clasesPorReservar).toBe(2);
  });

  it('un administrador elimina la clase de cualquier alumno', async () => {
    const clase = await crear(datosValidos, actor);

    expect(await eliminar(clase._id.toString(), actorAdministrador)).not.toBeNull();

    expect((await AlumnoModel.findById(alumnoId))?.clasesPorReservar).toBe(2);
  });

  it('el horario de una clase eliminada se puede volver a reservar', async () => {
    const clase = await crear(datosValidos, actor);
    await eliminar(clase._id.toString(), actor);

    const otraReserva = await crear(
      { ...datosValidos, alumno: otroAlumnoId.toString() },
      actorAdministrador,
    );

    expect(otraReserva.inicio.getTime()).toBe(inicioBase.getTime());
  });

  // --------------------------------------------------------
  //  obtenerPorIdAlumno
  // --------------------------------------------------------
  it('obtenerPorIdAlumno devuelve el alumno de la clase, o null si no existe', async () => {
    const clase = await crear(datosValidos, actor);

    expect(await obtenerPorIdAlumno(clase._id.toString())).toBe(alumnoId.toString());
    expect(await obtenerPorIdAlumno(new Types.ObjectId().toString())).toBeNull();
  });

  it('devuelve null al buscar un ID inexistente', async () => {
    expect(await obtenerPorId(new Types.ObjectId().toString(), actor)).toBeNull();
  });
});
