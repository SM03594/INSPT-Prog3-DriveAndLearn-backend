import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { TokenRevocadoModel } from '../../src/models/TokenRevocado.js';
import { ErrorAutenticacion } from '../../src/errors/errorAutenticacion.js';
import {
  revocarToken,
  tokenEstaRevocado,
} from '../../src/services/auth.service.js';
import { setupTestDB } from '../setupTestDB.js';

setupTestDB();

describe('auth.service: revocación de tokens', () => {
  it('guarda el hash del token y permite consultar su revocación', async () => {
    const token = 'jwt-de-prueba';
    const exp = Math.floor(Date.now() / 1000) + 3600;

    await revocarToken(token, exp);

    expect(await tokenEstaRevocado(token)).toBe(true);
    const registro = await TokenRevocadoModel.findOne();
    expect(registro?.hash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(registro?.hash).not.toBe(token);
    expect(registro?.expiraEn.getTime()).toBe(exp * 1000);
  });

  it('no considera revocado otro token', async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    await revocarToken('jwt-revocado', exp);

    expect(await tokenEstaRevocado('otro-jwt')).toBe(false);
  });

  it('ignora una revocación vencida aunque Mongo todavía no la haya eliminado', async () => {
    const token = 'jwt-con-revocacion-vencida';
    const hash = createHash('sha256').update(token).digest('hex');
    await TokenRevocadoModel.create({
      hash,
      expiraEn: new Date(Date.now() - 1000),
    });

    expect(await tokenEstaRevocado(token)).toBe(false);
  });

  it('rechaza revocar un token vencido', async () => {
    const exp = Math.floor(Date.now() / 1000) - 1;

    await expect(revocarToken('jwt-vencido', exp)).rejects.toThrow(ErrorAutenticacion);
    expect(await TokenRevocadoModel.countDocuments()).toBe(0);
  });

  it('no duplica el registro si se revoca el mismo token más de una vez', async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;

    await Promise.all([
      revocarToken('jwt-repetido', exp),
      revocarToken('jwt-repetido', exp),
    ]);

    expect(await TokenRevocadoModel.countDocuments()).toBe(1);
  });
});