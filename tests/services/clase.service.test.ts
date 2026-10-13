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
  cancelar,
  type ActorClase,
  type DatosClase,
} from '../../src/services/clase.service.js';

setupTestDB();

const actor: ActorClase = { id: '', role: 'alumno' };
const actorAdministrador: ActorClase = { id: '', role: 'administrador' };
let alumnoId: Types.ObjectId;
let otroAlumnoId: Types.ObjectId;
let profesorId: Types.ObjectId;
let profesorAlternativoId: Types.ObjectId;
let autoId: Types.ObjectId;
let autoAlternativoId: Types.ObjectId;
let administradorId: Types.ObjectId;
let inicioBase: Date;
let datosValidos: DatosClase;

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
    inicio: inicioBase.toISOString(),
    fin: finBase.toISOString(),
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
      crear({ ...datosValidos, fin: new Date(inicioBase.getTime() + 30 * 60 * 1000).toISOString() }, actor),
    ).rejects.toThrow(/exactamente una hora/i);
  });

  it('rechaza reservas pasadas y fuera del horario escolar', async () => {
    await expect(
      crear({
        ...datosValidos,
        inicio: '2020-09-20T12:00:00.000Z',
        fin: '2020-09-20T13:00:00.000Z',
      }, actor),
    ).rejects.toThrow(/fecha futura/i);

    await expect(
      crear({
        ...datosValidos,
        inicio: new Date(inicioBase.getTime() + 11 * 60 * 60 * 1000).toISOString(),
        fin: new Date(inicioBase.getTime() + 12 * 60 * 60 * 1000).toISOString(),
      }, actor),
    ).rejects.toThrow(/horario de la escuela/i);
  });

  it('rechaza clases fuera de disponibilidad o con el auto fuera de servicio', async () => {
    const domingo = new Date(inicioBase.getTime() + 6 * 24 * 60 * 60 * 1000);
    await expect(
      crear({
        ...datosValidos,
        inicio: domingo.toISOString(),
        fin: new Date(domingo.getTime() + 60 * 60 * 1000).toISOString(),
      }, actor),
    ).rejects.toThrow(/profesor no está disponible/i);

    await AutoModel.findByIdAndUpdate(autoId, { activo: false });
    await expect(crear(datosValidos, actor)).rejects.toThrow(/auto no está disponible/i);
  });

  it('rechaza si no hay créditos o si profesor/auto ya están ocupados', async () => {
    await AlumnoModel.findByIdAndUpdate(alumnoId, { clasesPorReservar: 0 });
    await expect(crear(datosValidos, actor)).rejects.toThrow(/clases disponibles/i);

    await AlumnoModel.findByIdAndUpdate(alumnoId, { clasesPorReservar: 2 });
    await crear(datosValidos, actor);
    await expect(crear({
      ...datosValidos,
      alumno: otroAlumnoId.toString(),
    }, actorAdministrador)).rejects.toThrow(/ya tiene una clase/i);
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
      role: 'alumno',
    } as const;
    expect(await obtenerPorId(clase._id.toString(), otroActor)).toBeNull();
    expect(await actualizar(clase._id.toString(), { profesor: profesorAlternativoId.toString() }, otroActor)).toBeNull();
    expect(await cancelar(clase._id.toString(), otroActor)).toBeNull();
    expect(await listar(actorAdministrador)).toHaveLength(1);
  });

  it('reprograma una reserva validando disponibilidad y conserva su crédito', async () => {
    const clase = await crear(datosValidos, actor);
    const nuevaInicio = new Date(inicioBase.getTime() + 2 * 60 * 60 * 1000);
    const actualizada = await actualizar(
      clase._id.toString(),
      { inicio: nuevaInicio.toISOString(), profesor: profesorAlternativoId.toString() },
      actor,
    );
    const alumno = await AlumnoModel.findById(alumnoId);

    expect(actualizada?.inicio.toISOString()).toBe(nuevaInicio.toISOString());
    expect(actualizada?.fin.toISOString()).toBe(
      new Date(nuevaInicio.getTime() + 60 * 60 * 1000).toISOString(),
    );
    expect(alumno?.clasesPorReservar).toBe(1);
  });

  it('cancela una clase futura y devuelve el crédito una única vez', async () => {
    const clase = await crear(datosValidos, actor);
    await cancelar(clase._id.toString(), actor);
    await cancelar(clase._id.toString(), actor);

    const alumno = await AlumnoModel.findById(alumnoId);
    expect((await obtenerPorId(clase._id.toString(), actor))?.estado).toBe('cancelada');
    expect(alumno?.clasesPorReservar).toBe(2);
  });

  it('no permite cancelar una clase que ya comenzó', async () => {
    const clase = await ClaseModel.create({
      alumno: alumnoId,
      profesor: profesorId,
      auto: autoId,
      inicio: new Date('2020-09-20T12:00:00.000Z'),
      fin: new Date('2020-09-20T13:00:00.000Z'),
    });

    await expect(cancelar(clase._id.toString(), actor)).rejects.toThrow(
      /solo se pueden cancelar clases futuras/i,
    );
    expect((await AlumnoModel.findById(alumnoId))?.clasesPorReservar).toBe(2);
  });

  it('devuelve null al buscar un ID inexistente', async () => {
    expect(await obtenerPorId(new Types.ObjectId().toString(), actor)).toBeNull();
  });
});
