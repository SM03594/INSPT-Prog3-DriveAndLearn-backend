import bcrypt from 'bcrypt';
import ErrorPasswordInvalida from '../../errors/ErrorPasswordInvalida.js';

const SALT_ROUNDS = 10;
const MIN_LONGITUD_PASSWORD = 8;

export function validarPassword(password) {
  if (typeof password !== 'string' || password.length < MIN_LONGITUD_PASSWORD) {
    throw new ErrorPasswordInvalida(
      `La contraseña debe tener al menos ${MIN_LONGITUD_PASSWORD} caracteres`
    );
  }
}

export async function hashearPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

export async function validarYHashearPassword(password) {
  validarPassword(password);
  return await hashearPassword(password);
}
