import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import app from '../src/app.js';
import { crear as crearAlumno } from '../src/services/alumno.service.js';
import { sumarClasesPorReservar } from '../src/services/alumno.service.js';
import { crear as crearAdministrador } from '../src/services/administrador.service.js';
import { crearCalendarioSemanal } from '../src/models/CalendarioSemanal.js';
import { AutoModel } from '../src/models/Auto.js';
import { ClaseModel } from '../src/models/Clase.js';
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
  });
  await sumarClasesPorReservar(alumno._id.toString(), 2);
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

    const perfil = await request(app)
      .get(`/api/alumnos/${alumnoId}`)
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .expect(200);
    expect(perfil.body.clasesPorReservar).toBe(1);
  });

  it('rechaza una clase que no empieza en una hora en punto (08:20–09:20 → 400)', async () => {
    const inicioConMinutos = new Date(inicio.getTime() + 20 * 60 * 1000);

    const respuesta = await request(app)
      .post('/api/clases')
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .send({
        profesor: profesorId,
        auto: autoId,
        inicio: inicioConMinutos.toISOString(),
        fin: new Date(inicioConMinutos.getTime() + 60 * 60 * 1000).toISOString(),
      })
      .expect(400);

    expect(respuesta.body.mensaje).toBe('La clase debe empezar en una hora en punto (por ejemplo, 08:00)');
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
    });
    await sumarClasesPorReservar(otro._id.toString(), 1);
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
      .put('/api/horario-escuela')
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
      .put('/api/horario-escuela')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(calendario)
      .expect(200);

    const respuesta = await request(app)
      .get('/api/horario-escuela')
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .expect(200);
    expect(respuesta.body.martes).toHaveLength(1);
    expect(respuesta.body.lunes).toHaveLength(0);
  });
});

// ============================================================
//  DELETE /api/clases/:id
// ============================================================
describe('eliminar clases por HTTP', () => {
  // Reserva una clase como el alumno del beforeEach y devuelve su id.
  async function reservarComoAlumno(): Promise<string> {
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
    return reserva.body._id as string;
  }

  async function saldoDelAlumno(): Promise<number> {
    const perfil = await request(app)
      .get(`/api/alumnos/${alumnoId}`)
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .expect(200);
    return perfil.body.clasesPorReservar as number;
  }

  it('el alumno elimina su clase futura: 204 y recupera el crédito', async () => {
    const claseId = await reservarComoAlumno();
    expect(await saldoDelAlumno()).toBe(1);

    const respuesta = await request(app)
      .delete(`/api/clases/${claseId}`)
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .expect(204);

    expect(respuesta.body).toEqual({});
    expect(await saldoDelAlumno()).toBe(2);
    await request(app)
      .get(`/api/clases/${claseId}`)
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .expect(404);
  });

  it('eliminar dos veces: la segunda responde 404 y no devuelve otro crédito', async () => {
    const claseId = await reservarComoAlumno();
    await request(app).delete(`/api/clases/${claseId}`).set('Authorization', `Bearer ${tokenAlumno}`).expect(204);

    const respuesta = await request(app)
      .delete(`/api/clases/${claseId}`)
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .expect(404);

    expect(respuesta.body.mensaje).toBe('Clase no encontrada');
    expect(await saldoDelAlumno()).toBe(2);
  });

  it('otro alumno no puede eliminarla: 403 y la clase sigue', async () => {
    const claseId = await reservarComoAlumno();
    await crearAlumno({ email: 'otro@example.com', password: 'claveSegura123', nomApe: 'Otro alumno' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'otro@example.com', password: 'claveSegura123' })
      .expect(200);

    const respuesta = await request(app)
      .delete(`/api/clases/${claseId}`)
      .set('Authorization', `Bearer ${login.body.token as string}`)
      .expect(403);

    expect(respuesta.body.mensaje).toBe('Solo podés acceder a tus propias clases');
    expect(await ClaseModel.findById(claseId)).not.toBeNull();
  });

  it('otro alumno tampoco puede verla ni modificarla: 403', async () => {
    const claseId = await reservarComoAlumno();
    await crearAlumno({ email: 'otro@example.com', password: 'claveSegura123', nomApe: 'Otro alumno' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'otro@example.com', password: 'claveSegura123' })
      .expect(200);
    const tokenOtro = `Bearer ${login.body.token as string}`;

    const ver = await request(app).get(`/api/clases/${claseId}`).set('Authorization', tokenOtro).expect(403);
    const modificar = await request(app)
      .put(`/api/clases/${claseId}`)
      .set('Authorization', tokenOtro)
      .send({ profesor: profesorId })
      .expect(403);
    // El permiso se revisa antes que el body: sin body, también 403 (no 400).
    await request(app).put(`/api/clases/${claseId}`).set('Authorization', tokenOtro).expect(403);

    expect(ver.body.mensaje).toBe('Solo podés acceder a tus propias clases');
    expect(modificar.body.mensaje).toBe('Solo podés acceder a tus propias clases');
  });

  it('un administrador elimina la clase de un alumno', async () => {
    const claseId = await reservarComoAlumno();

    await request(app)
      .delete(`/api/clases/${claseId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(204);

    expect(await saldoDelAlumno()).toBe(2);
  });

  it('una clase que ya ocurrió se elimina sin devolver el crédito', async () => {
    const clase = await ClaseModel.create({
      alumno: alumnoId,
      profesor: profesorId,
      auto: autoId,
      inicio: new Date('2020-09-21T12:00:00.000Z'),
      fin: new Date('2020-09-21T13:00:00.000Z'),
    });

    await request(app)
      .delete(`/api/clases/${clase._id.toString()}`)
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .expect(204);

    expect(await saldoDelAlumno()).toBe(2);
  });

  it('una clase que no existe responde 404', async () => {
    const respuesta = await request(app)
      .delete(`/api/clases/${new Types.ObjectId().toString()}`)
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .expect(404);

    expect(respuesta.body.mensaje).toBe('Clase no encontrada');
  });

  it('un id mal formado responde 400', async () => {
    const respuesta = await request(app)
      .delete('/api/clases/abc')
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .expect(400);

    expect(respuesta.body.mensaje).toBe('Id inválido');
  });

  it('sin token responde 401', async () => {
    const claseId = await reservarComoAlumno();

    await request(app).delete(`/api/clases/${claseId}`).expect(401);
  });

  it('la ruta vieja PATCH /clases/:id/cancelar ya no existe', async () => {
    const claseId = await reservarComoAlumno();

    const respuesta = await request(app)
      .patch(`/api/clases/${claseId}/cancelar`)
      .set('Authorization', `Bearer ${tokenAlumno}`)
      .expect(404);

    expect(respuesta.body.mensaje).toBe('Ruta no encontrada');
  });
});
