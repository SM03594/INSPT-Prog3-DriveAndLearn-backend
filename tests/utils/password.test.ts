// ============================================================
//  password.test.ts — Tests de src/utils/password.ts (sin DB)
// ============================================================

import { describe, it, expect } from 'vitest';
import bcrypt from 'bcrypt';
import { conPasswordHasheada } from '../../src/utils/password.js';
import { ErrorDeNegocio } from '../../src/errors/errorDeNegocio.js';

describe('conPasswordHasheada', () => {
  it('reemplaza el password por un hash que coincide con el original', async () => {
    const datos = { email: 'ana@example.com', password: 'claveSegura' };

    const resultado = await conPasswordHasheada(datos);

    expect(resultado.password).not.toBe('claveSegura');
    expect(await bcrypt.compare('claveSegura', resultado.password)).toBe(true);
    expect(resultado.email).toBe('ana@example.com'); // el resto no cambia
  });

  it('no modifica el objeto original', async () => {
    const datos = { password: 'claveSegura' };

    await conPasswordHasheada(datos);

    expect(datos.password).toBe('claveSegura');
  });

  it('acepta una contraseña de exactamente 8 caracteres', async () => {
    await expect(conPasswordHasheada({ password: '12345678' })).resolves.toBeDefined();
  });

  it('rechaza una contraseña de 7 caracteres', async () => {
    await expect(conPasswordHasheada({ password: '1234567' })).rejects.toThrow(
      /al menos 8 caracteres/,
    );
  });

  it('rechaza la contraseña vacía', async () => {
    await expect(conPasswordHasheada({ password: '' })).rejects.toThrow(ErrorDeNegocio);
  });

  it('rechaza un password que no es texto (ej. un número)', async () => {
    await expect(conPasswordHasheada({ password: 12345678 })).rejects.toThrow(
      /debe ser un texto/,
    );
  });

  it('devuelve los datos sin tocar si no viene password', async () => {
    // Como un Partial<Alumno> de actualizar: password existe en el tipo,
    // pero en este objeto no vino.
    const datos: { nomApe?: string; password?: string } = { nomApe: 'Ana Pérez' };

    expect(await conPasswordHasheada(datos)).toBe(datos);
  });
});
