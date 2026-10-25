import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { crear as crearAdministrador } from '../../src/services/administrador.service.js';
import { setupTestDB } from '../setupTestDB.js';

process.env.JWT_SECRET = 'secreto-de-prueba-de-al-menos-32-caracteres';
setupTestDB();

const MENSAJE_SIN_CUERPO = 'La petición debe incluir un cuerpo JSON';
const MENSAJE_NO_OBJETO = 'El cuerpo de la petición debe ser un objeto JSON';
const MENSAJE_JSON_MAL_ESCRITO = 'El cuerpo de la petición no es un JSON válido';

// Un ObjectId con forma válida: el middleware corta antes de buscarlo.
const ID = '64b7f0f0f0f0f0f0f0f0f0f0';

type Metodo = 'post' | 'put' | 'patch' | 'delete';

// Todas las rutas que llevan validacionDeCuerpo. Si se agrega una
// ruta con body, sumarla acá: el test controla que tenga el middleware.
const RUTAS_CON_CUERPO: [Metodo, string][] = [
  ['post', '/api/auth/login'],
  ['post', '/api/alumnos'],
  ['put', `/api/alumnos/${ID}`],
  ['patch', `/api/alumnos/${ID}/sumar-clases`],
  ['patch', `/api/alumnos/${ID}/restar-clases`],
  ['post', '/api/administradores'],
  ['put', `/api/administradores/${ID}`],
  ['post', '/api/autos'],
  ['put', `/api/autos/${ID}`],
  ['patch', `/api/autos/${ID}/activo`],
  ['post', '/api/profesores'],
  ['patch', `/api/profesores/${ID}/nom-ape`],
  ['post', `/api/profesores/${ID}/disponibilidad`],
  ['delete', `/api/profesores/${ID}/disponibilidad`],
  ['put', '/api/horario-escuela'],
  ['post', '/api/horario-escuela/agregar'],
  ['post', '/api/horario-escuela/quitar'],
  ['post', '/api/clases'],
  ['put', `/api/clases/${ID}`],
];

describe('validacionDeCuerpo HTTP', () => {
  let tokenAdmin: string;

  beforeEach(async () => {
    await crearAdministrador({
      email: 'admin@example.com',
      password: 'claveAdmin123',
      nomApe: 'Admin',
    });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'claveAdmin123' })
      .expect(200);
    tokenAdmin = login.body.token as string;
  });

  function pedir(metodo: Metodo, ruta: string) {
    return request(app)[metodo](ruta).set('Authorization', `Bearer ${tokenAdmin}`);
  }

  it.each(RUTAS_CON_CUERPO)('%s %s sin body → 400', async (metodo, ruta) => {
    const respuesta = await pedir(metodo, ruta).expect(400);

    expect(respuesta.body.mensaje).toBe(MENSAJE_SIN_CUERPO);
  });

  it.each(RUTAS_CON_CUERPO)('%s %s con un array → 400', async (metodo, ruta) => {
    const respuesta = await pedir(metodo, ruta).send([]).expect(400);

    expect(respuesta.body.mensaje).toBe(MENSAJE_NO_OBJETO);
  });

  it('body vacío con Content-Type JSON → 400 sin cuerpo', async () => {
    const respuesta = await pedir('patch', `/api/profesores/${ID}/nom-ape`)
      .set('Content-Type', 'application/json')
      .send('')
      .expect(400);

    expect(respuesta.body.mensaje).toBe(MENSAJE_SIN_CUERPO);
  });

  it('JSON mal escrito → 400', async () => {
    const respuesta = await pedir('post', '/api/horario-escuela/agregar')
      .set('Content-Type', 'application/json')
      .send('{"dia": "lunes",')
      .expect(400);

    expect(respuesta.body.mensaje).toBe(MENSAJE_JSON_MAL_ESCRITO);
  });

  it('sin token y sin body → sigue respondiendo 401 (la autenticación va primero)', async () => {
    await request(app).post('/api/horario-escuela/agregar').expect(401);
  });

  it('PATCH /clases/:id/cancelar no lleva el middleware (no necesita body)', async () => {
    const respuesta = await pedir('patch', `/api/clases/${ID}/cancelar`);

    expect(respuesta.status).not.toBe(400);
  });
});
