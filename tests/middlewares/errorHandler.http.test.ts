import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';

// Sin setupTestDB(): express.json() rechaza el body antes de llegar a
// cualquier router, así que estos pedidos nunca tocan la base.
describe('errorHandler — body ilegible', () => {
  it('responde 400 si el JSON está mal formado', async () => {
    const respuesta = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "a@b.com",');

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.mensaje).toContain('JSON válido');
  });

  it('responde 413 si el body supera el límite de express.json()', async () => {
    // El límite por defecto de express.json() es 100 KB.
    const respuesta = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ relleno: 'a'.repeat(200 * 1024) }));

    expect(respuesta.status).toBe(413);
    expect(respuesta.body.mensaje).toContain('demasiado grande');
  });
});
