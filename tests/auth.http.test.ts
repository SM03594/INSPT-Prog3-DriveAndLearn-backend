import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { crear as crearAlumno } from '../src/services/alumno.service.js';
import { crear as crearAdministrador } from '../src/services/administrador.service.js';
import { setupTestDB } from './setupTestDB.js';

process.env.JWT_SECRET = 'secreto-de-prueba-de-al-menos-32-caracteres';
setupTestDB();

describe('autenticación HTTP', () => {
  async function iniciarSesion(email: string, password: string): Promise<string> {
    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    return respuesta.body.token as string;
  }

  it('permite registrar alumnos y autenticar sus credenciales', async () => {
    await request(app)
      .post('/api/alumnos')
      .send({
        email: 'sin-clases@example.com',
        password: 'claveSegura123',
        nomApe: 'Sin Clases',
        clasesPorReservar: 100,
      })
      .expect(400);

    const registro = await request(app)
      .post('/api/alumnos')
      .send({
        email: 'ana@example.com',
        password: 'claveSegura123',
        nomApe: 'Ana Pérez',
      })
      .expect(201);

    expect(registro.body.password).toBeUndefined();

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ANA@example.com', password: 'claveSegura123' })
      .expect(200);

    expect(login.body.token).toEqual(expect.any(String));
    expect(login.body.usuario).toMatchObject({
      id: registro.body._id,
      email: 'ana@example.com',
      nomApe: 'Ana Pérez',
      role: 'alumno',
    });
    expect(login.body.usuario.password).toBeUndefined();

    await request(app)
      .get('/api/autos')
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);
  });

  it('autentica administradores con rol identificado en el token', async () => {
    await crearAdministrador({
      email: 'admin@example.com',
      password: 'claveAdmin123',
      nomApe: 'Administradora',
    });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'claveAdmin123' })
      .expect(200);

    expect(login.body.usuario.role).toBe('administrador');
    expect(login.body.token).toEqual(expect.any(String));
  });

  it('rechaza credenciales incorrectas con un mensaje genérico', async () => {
    await crearAlumno({
      email: 'ana@example.com',
      password: 'claveSegura123',
      nomApe: 'Ana Pérez',
      clasesPorReservar: 0,
    });

    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@example.com', password: 'incorrecta123' })
      .expect(401);

    expect(respuesta.body.mensaje).toBe('Email o contraseña incorrectos');
  });

  it('rechaza un email inexistente con el mismo mensaje genérico', async () => {
    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nadie@example.com', password: 'claveSegura123' })
      .expect(401);

    expect(respuesta.body.mensaje).toBe('Email o contraseña incorrectos');
  });

  it('exige un JWT válido para las rutas protegidas', async () => {
    await request(app).get('/api/autos').expect(401);

    await request(app)
      .get('/api/autos')
      .set('Authorization', 'Bearer token-invalido')
      .expect(401);
  });

  it('rechaza con error de autenticación si faltan email o contraseña', async () => {
    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ email: '', password: '' })
      .expect(401);

    expect(respuesta.body.mensaje).toBe('Email y contraseña son obligatorios');
  });

  it('permite a un alumno gestionar su perfil, pero no el de otros usuarios', async () => {
    const alumno = await crearAlumno({
      email: 'ana@example.com',
      password: 'claveSegura123',
      nomApe: 'Ana Pérez',
      clasesPorReservar: 0,
    });
    const otroAlumno = await crearAlumno({
      email: 'otro@example.com',
      password: 'claveSegura123',
      nomApe: 'Otro Alumno',
      clasesPorReservar: 0,
    });
    const token = await iniciarSesion('ana@example.com', 'claveSegura123');

    await request(app)
      .put(`/api/alumnos/${alumno._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nomApe: 'Ana Actualizada' })
      .expect(200);

    await request(app)
      .put(`/api/alumnos/${alumno._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ clasesPorReservar: 100 })
      .expect(403);

    await request(app)
      .put(`/api/alumnos/${otroAlumno._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nomApe: 'Cambio no autorizado' })
      .expect(403);

    await request(app)
      .delete(`/api/alumnos/${otroAlumno._id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    await request(app)
      .get('/api/alumnos')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    await request(app)
      .post('/api/administradores')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'no-autorizado@example.com',
        password: 'claveAdmin123',
        nomApe: 'No autorizado',
      })
      .expect(403);

    await request(app)
      .delete(`/api/alumnos/${alumno._id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
  });

  it('permite a un administrador actualizar y eliminar otras cuentas', async () => {
    const administrador = await crearAdministrador({
      email: 'admin@example.com',
      password: 'claveAdmin123',
      nomApe: 'Administradora',
    });
    const otroAdministrador = await crearAdministrador({
      email: 'admin2@example.com',
      password: 'claveAdmin123',
      nomApe: 'Segundo administrador',
    });
    const alumno = await crearAlumno({
      email: 'alumno@example.com',
      password: 'claveSegura123',
      nomApe: 'Alumno',
      clasesPorReservar: 0,
    });
    const token = await iniciarSesion('admin@example.com', 'claveAdmin123');

    await request(app)
      .put(`/api/alumnos/${alumno._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nomApe: 'Alumno actualizado', clasesPorReservar: 2 })
      .expect(200);

    await request(app)
      .put(`/api/administradores/${otroAdministrador._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nomApe: 'Administrador actualizado' })
      .expect(200);

    await request(app)
      .delete(`/api/alumnos/${alumno._id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    await request(app)
      .delete(`/api/administradores/${otroAdministrador._id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    await request(app)
      .delete(`/api/administradores/${administrador._id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    await request(app)
      .get('/api/administradores')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });
});
