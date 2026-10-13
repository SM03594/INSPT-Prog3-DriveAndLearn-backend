import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import app from '../src/app.js';
import { crear as crearAlumno } from '../src/services/alumno.service.js';
import { crear as crearAdministrador } from '../src/services/administrador.service.js';
import { crearCalendarioSemanal } from '../src/models/CalendarioSemanal.js';
import { AutoModel } from '../src/models/Auto.js';
import { ProfesorModel } from '../src/models/Profesor.js';
import { HorarioEscuelaModel } from '../src/models/HorarioEscuela.js';
import { aHoraLocal } from '../src/utils/fechas.js';
import { setupTestDB } from './setupTestDB.js';

process.env.JWT_SECRET = 'secreto-de-prueba-de-al-menos-32-caracteres';
setupTestDB();

let profesorId: string;
let autoId: string;
let inicio: Date;
let tokenAlumno: string;
let tokenAdmin: string;
let alumnoId: string;

function proximoLunes(): Date {
  const fecha = new Date();
  fecha.setUTCHours(12, 0, 0, 0);
  do {
    fecha.setUTCDate(fecha.getUTCDate() + 1);
  } while (aHoraLocal(fecha).dia !== 'lunes');
  return fecha;
}

beforeEach(async () => {
  const alumno = await crearAlumno({
    email: 'alumno@example.com',
    password: 'claveSegura123',
    nomApe: 'Alumno',
    clasesPorReservar: 2,
  });
  const administrador = await crearAdministrador({
    email: 'admin@example.com',
    password: 'claveAdmin123',
    nomApe: 'Admin',
  });
  alumnoId = alumno._id.toString();

  const profesor = await ProfesorModel.create({
    nomApe: 'Profesor',
    disponibilidad: {
      lunes: [{ horaInicio: { hora: 9, minuto: 0 }, horaFin: { hora: 17, minuto: 0 } }],
    },
  });
  const auto = await AutoModel.create({
    patente: `AA${new Types.ObjectId().toString().slice(-5)}A`,
    cambios: 'MANUAL',
    activo: true,
  });
  profesorId = profesor._id.toString();
  autoId = auto._id.toString();

  const horarioEscuela = crearCalendarioSemanal();
  horarioEscuela.lunes.push({
    horaInicio: { hora: 8, minuto: 0 },
    horaFin: { hora: 18, minuto: 0 },
  });
  await HorarioEscuelaModel.create({ _id: 'escuela', calendario: horarioEscuela });

  inicio = proximoLunes();
  const [loginAlumno, loginAdmin] = await Promise.all([
    request(app).post('/api/auth/login').send({
      email: 'alumno@example.com',
      password: 'claveSegura123',
    }).expect(200),
    request(app).post('/api/auth/login').send({
      email: 'admin@example.com',
      password: 'claveAdmin123',
    }).expect(200),
  ]);
  tokenAlumno = loginAlumno.body.token as string;
  tokenAdmin = loginAdmin.body.token as string;
});

describe('reservas HTTP de clases', () => {
  it('permite crear un profesor únicamente al administrador', async () => {
    await request(app)
      .post('/api/profesores')
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({ nomApe: 'No autorizado' })
      .expect(403);

    const respuesta = await request(app)
      .post('/api/profesores')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nomApe: 'Profesor nuevo' })
      .expect(201);
    expect(respuesta.body.nomApe).toBe('Profesor nuevo');
    expect(respuesta.body.disponibilidad.lunes).toEqual([]);
  });

  it('fuerza la identidad del alumno y descuenta un crédito al reservar', async () => {
    await request(app)
      .post('/api/clases')
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({
        alumno: new Types.ObjectId().toString(),
        profesor: profesorId,
        auto: autoId,
        inicio: inicio.toISOString(),
        fin: new Date(inicio.getTime() + 60 * 60 * 1000).toISOString(),
      })
      .expect(400);

    const reserva = await request(app)
      .post('/api/clases')
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({
        profesor: profesorId,
        auto: autoId,
        inicio: inicio.toISOString(),
        fin: new Date(inicio.getTime() + 60 * 60 * 1000).toISOString(),
      })
      .expect(201);

    expect(reserva.body.alumno).toBe(alumnoId);
    expect(reserva.body.estado).toBe('pendiente');

    const perfil = await request(app)
      .get(`/api/alumnos/${alumnoId}`)
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .expect(200);
    expect(perfil.body.clasesPorReservar).toBe(1);
  });

  it('limita consultas de clases al alumno y permite al administrador ver todas', async () => {
    const propia = await request(app)
      .post('/api/clases')
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({
        profesor: profesorId,
        auto: autoId,
        inicio: inicio.toISOString(),
        fin: new Date(inicio.getTime() + 60 * 60 * 1000).toISOString(),
      })
      .expect(201);
    const otro = await crearAlumno({
      email: 'otro@example.com',
      password: 'claveSegura123',
      nomApe: 'Otro alumno',
      clasesPorReservar: 1,
    });
    await request(app)
      .post('/api/clases')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        alumno: otro._id.toString(),
        profesor: profesorId,
        auto: autoId,
        inicio: new Date(inicio.getTime() + 60 * 60 * 1000).toISOString(),
        fin: new Date(inicio.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      })
      .expect(201);

    const listadoAlumno = await request(app)
      .get('/api/clases')
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .expect(200);
    expect(listadoAlumno.body).toHaveLength(1);

    await request(app)
      .get(`/api/clases/${propia.body._id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    const listadoAdmin = await request(app)
      .get('/api/clases')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(listadoAdmin.body).toHaveLength(2);
  });

  it('no permite al alumno administrar el horario general de la escuela', async () => {
    await request(app)
      .put('/api/horario')
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send(crearCalendarioSemanal())
      .expect(403);

    await request(app)
      .post(`/api/profesores/${profesorId}/disponibilidad`)
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({ dia: 'lunes', tramo: { horaInicio: { hora: 8, minuto: 0 }, horaFin: { hora: 18, minuto: 0 } } })
      .expect(403);

    await request(app)
      .patch(`/api/autos/${autoId}/activo`)
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({ activo: false })
      .expect(403);
  });

  it('persiste el horario general cuando lo modifica un administrador', async () => {
    const calendario = crearCalendarioSemanal();
    calendario.martes.push({
      horaInicio: { hora: 9, minuto: 0 },
      horaFin: { hora: 17, minuto: 0 },
    });

    await request(app)
      .put('/api/horario')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(calendario)
      .expect(200);

    const respuesta = await request(app)
      .get('/api/horario')
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .expect(200);
    expect(respuesta.body.martes).toHaveLength(1);
    expect(respuesta.body.lunes).toHaveLength(0);
  });
});
