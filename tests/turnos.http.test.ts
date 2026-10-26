// ============================================================
//  turnos.http.test.ts — POST /api/profesores/:id/turnos-libres
// ============================================================
// La consulta de punta a punta, por HTTP: ruta, middlewares, DTO,
// controller y service. Los casos de cada regla están en
// turno.service.test.ts y turno.dto.test.ts; acá se prueba que lleguen
// bien al cliente (status, mensaje y forma de la respuesta).
//
// Escenario: la escuela abre los lunes de 08 a 18; el profesor trabaja
// los lunes de 09 a 17; hay un solo auto, manual y sin marca ni modelo.

import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import app from '../src/app.js';
import {
  crear as crearAlumno,
  sumarClasesPorReservar,
} from '../src/services/alumno.service.js';
import { crear as crearAdministrador } from '../src/services/administrador.service.js';
import { AlumnoModel } from '../src/models/Alumno.js';
import { AutoModel } from '../src/models/Auto.js';
import { ProfesorModel } from '../src/models/Profesor.js';
import { HorarioEscuelaModel } from '../src/models/HorarioEscuela.js';
import { crearCalendarioSemanal } from '../src/models/CalendarioSemanal.js';
import {
  aHoraLocal,
  formatearFecha,
  hoyEnLaEscuela,
  instanteLocal,
  type FechaCalendario,
} from '../src/utils/fechas.js';
import { setupTestDB } from './setupTestDB.js';

process.env.JWT_SECRET = 'secreto-de-prueba-de-al-menos-32-caracteres';
setupTestDB();

const DIA_MS = 24 * 60 * 60 * 1000;

let alumnoId: string;
let profesorId: string;
let autoId: string;
let tokenAlumno: string;
let tokenAdmin: string;
let lunes: FechaCalendario;

// El próximo lunes de la escuela, a 7 días o más (nunca es "hoy").
function proximoLunes(): FechaCalendario {
  let instante = new Date(Date.now() + 7 * DIA_MS);
  while (aHoraLocal(instante).dia !== 'lunes') {
    instante = new Date(instante.getTime() + DIA_MS);
  }
  return hoyEnLaEscuela(instante);
}

function consultar(token: string | null, body: object, id: string = profesorId) {
  const pedido = request(app).post(`/api/profesores/${id}/turnos-libres`);
  return token === null ? pedido.send(body) : pedido.set('Authorization', `Bearer ${token}`).send(body);
}

beforeEach(async () => {
  lunes = proximoLunes();

  const alumno = await crearAlumno({
    email: 'alumno@example.com',
    password: 'claveSegura123',
    nomApe: 'Alumno',
  });
  await sumarClasesPorReservar(alumno._id.toString(), 2);
  await crearAdministrador({
    email: 'admin@example.com',
    password: 'claveAdmin123',
    nomApe: 'Admin',
  });
  alumnoId = alumno._id.toString();

  const profesor = await ProfesorModel.create({
    nomApe: 'Profesor',
    disponibilidad: {
      ...crearCalendarioSemanal(),
      lunes: [{ horaInicio: { hora: 9, minuto: 0 }, horaFin: { hora: 17, minuto: 0 } }],
    },
  });
  const auto = await AutoModel.create({ patente: 'AA111AA', cambios: 'MANUAL' });
  profesorId = profesor._id.toString();
  autoId = auto._id.toString();

  const escuela = crearCalendarioSemanal();
  escuela.lunes.push({ horaInicio: { hora: 8, minuto: 0 }, horaFin: { hora: 18, minuto: 0 } });
  await HorarioEscuelaModel.create({ _id: 'escuela', calendario: escuela });

  const [loginAlumno, loginAdmin] = await Promise.all([
    request(app).post('/api/auth/login').send({ email: 'alumno@example.com', password: 'claveSegura123' }).expect(200),
    request(app).post('/api/auth/login').send({ email: 'admin@example.com', password: 'claveAdmin123' }).expect(200),
  ]);
  tokenAlumno = loginAlumno.body.token as string;
  tokenAdmin = loginAdmin.body.token as string;
});

describe('POST /api/profesores/:id/turnos-libres', () => {
  it('alumno: 200 con los turnos del día, en ISO UTC y con los datos de cada auto', async () => {
    const respuesta = await consultar(tokenAlumno, { fecha: formatearFecha(lunes), cambios: 'manual' })
      .expect(200);

    expect(respuesta.body.fecha).toBe(formatearFecha(lunes));
    expect(respuesta.body.dia).toBe('lunes');
    expect(respuesta.body.turnos).toHaveLength(8); // de 09 a 16
    expect(respuesta.body.turnos[0].inicio).toBe(instanteLocal(lunes, { hora: 9, minuto: 0 }).toISOString());
    expect(respuesta.body.turnos[0].fin).toBe(instanteLocal(lunes, { hora: 10, minuto: 0 }).toISOString());
    // Solo los datos para elegir el auto: ni __v, ni activo, ni timestamps.
    expect(Object.keys(respuesta.body.turnos[0].autos[0]).sort()).toEqual(['_id', 'cambios', 'patente']);
    expect(respuesta.body.turnos[0].autos[0]._id).toBe(autoId);
  });

  it('admin: 200 con los mismos turnos', async () => {
    const respuesta = await consultar(tokenAdmin, { fecha: formatearFecha(lunes) }).expect(200);

    expect(respuesta.body.turnos).toHaveLength(8);
  });

  it('sin token → 401', async () => {
    await consultar(null, { fecha: formatearFecha(lunes) }).expect(401);
  });

  it('admin que manda "alumno" → 400, como cualquier campo de más', async () => {
    const respuesta = await consultar(tokenAdmin, { fecha: formatearFecha(lunes), alumno: alumnoId })
      .expect(400);

    expect(respuesta.body.mensaje).toBe('No se pueden enviar estos campos: alumno');
  });

  it.each([
    [{}, 'La fecha es obligatoria'],
    [{ fecha: '2026-02-31' }, 'La fecha debe tener el formato AAAA-MM-DD'],
    [{ fecha: '2020-01-06' }, 'La fecha debe ser hoy o posterior'],
  ])('fecha inválida %j → 400', async (body, mensaje) => {
    const respuesta = await consultar(tokenAlumno, body).expect(400);

    expect(respuesta.body.mensaje).toBe(mensaje);
  });

  it('desde posterior al hasta → 400', async () => {
    const respuesta = await consultar(tokenAlumno, {
      fecha: formatearFecha(lunes),
      desde: '12:00',
      hasta: '10:00',
    }).expect(400);

    expect(respuesta.body.mensaje).toBe('El desde debe ser anterior al hasta');
  });

  it('id de profesor mal formado → 400 "Id inválido"', async () => {
    const respuesta = await consultar(tokenAlumno, { fecha: formatearFecha(lunes) }, 'abc').expect(400);

    expect(respuesta.body.mensaje).toBe('Id inválido');
  });

  it('profesor inexistente → 404', async () => {
    const respuesta = await consultar(
      tokenAlumno,
      { fecha: formatearFecha(lunes) },
      new Types.ObjectId().toString(),
    ).expect(404);

    expect(respuesta.body.mensaje).toBe('Profesor no encontrado');
  });

  it('alumno sin saldo → 409', async () => {
    await AlumnoModel.findByIdAndUpdate(alumnoId, { clasesPorReservar: 0 });

    const respuesta = await consultar(tokenAlumno, { fecha: formatearFecha(lunes) }).expect(409);

    expect(respuesta.body.mensaje).toBe('No tenés clases disponibles para reservar');
  });

  it('ida y vuelta del admin: consulta, reserva el primer turno para un alumno y ya no aparece', async () => {
    const antes = await consultar(tokenAdmin, { fecha: formatearFecha(lunes) }).expect(200);
    const [primerTurno] = antes.body.turnos;

    await request(app)
      .post('/api/clases')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        alumno: alumnoId,
        profesor: profesorId,
        auto: primerTurno.autos[0]._id,
        inicio: primerTurno.inicio,
        fin: primerTurno.fin,
      })
      .expect(201);

    const despues = await consultar(tokenAdmin, { fecha: formatearFecha(lunes) }).expect(200);
    expect(despues.body.turnos.map((turno: { inicio: string }) => turno.inicio))
      .not.toContain(primerTurno.inicio);

    // La clase se descontó del saldo del alumno, no del admin.
    const alumno = await AlumnoModel.findById(alumnoId);
    expect(alumno?.clasesPorReservar).toBe(1);
  });
});
