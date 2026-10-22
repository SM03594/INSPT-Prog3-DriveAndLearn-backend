import bcrypt from 'bcrypt';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupTestDB } from '../setupTestDB.js';
import { crear as crearAlumno } from '../../src/services/alumno.service.js';
import { autenticar } from '../../src/services/auth.service.js';

process.env.JWT_SECRET = 'secreto-de-prueba-de-al-menos-32-caracteres';
setupTestDB();

afterEach(() => {
  vi.restoreAllMocks();
});

describe('auth.service', () => {
  it('compara contra un hash de descarte si el email no existe', async () => {
    const compare = vi.spyOn(bcrypt, 'compare');

    await expect(
      autenticar('nadie@example.com', 'claveSegura123'),
    ).rejects.toThrow('Email o contraseña incorrectos');

    expect(compare).toHaveBeenCalledTimes(1);
    expect(compare.mock.calls[0][0]).toBe('claveSegura123');
    expect(compare.mock.calls[0][1]).toMatch(/^\$2[aby]\$10\$/);
  });

  it('compara contra el hash del usuario encontrado', async () => {
    const alumno = await crearAlumno({
      email: 'ana@example.com',
      password: 'claveSegura123',
      nomApe: 'Ana Pérez',
    });
    const compare = vi.spyOn(bcrypt, 'compare');

    await expect(
      autenticar('ana@example.com', 'incorrecta123'),
    ).rejects.toThrow('Email o contraseña incorrectos');

    expect(compare).toHaveBeenCalledTimes(1);
    expect(compare.mock.calls[0][1]).toBe(alumno.password);
  });
});
