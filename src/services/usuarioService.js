import Usuario from '../models/Usuario.js';
import { validarMongooseObjId } from './helpers/validarMongooseObjId.js';

export async function obtenerPorId(id) {
  validarMongooseObjId(id);

  return await Usuario.findById(id);
}

export async function obtenerPorEmail(email) {
  if (typeof email !== 'string') {
    return null;
  }

  const emailNormalizado = email.trim().toLowerCase();

  return await Usuario.findOne({ email: emailNormalizado });
}
