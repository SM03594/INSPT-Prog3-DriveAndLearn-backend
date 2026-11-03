import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Usuario from '../models/Usuario.js';
import TokenRevocado from '../models/TokenRevocado.js';
import ErrorAutenticacion from '../errors/ErrorAutenticacion.js';
import { obtenerJwtSecret } from '../config/env.js';

export async function login({ email, password }) {
  const emailNormalizado = email.trim().toLowerCase();

  const usuario = await Usuario.findOne({ email: emailNormalizado });

  if (!usuario) {
    throw new ErrorAutenticacion('Credenciales inválidas');
  }

  const passwordValida = await bcrypt.compare(password, usuario.password);

  if (!passwordValida) {
    throw new ErrorAutenticacion('Credenciales inválidas');
  }

  const token = jwt.sign(
    {
      id: usuario._id.toString(),
      email: usuario.email,
      rol: usuario.rol,
      NomApe: usuario.NomApe,
    },
    obtenerJwtSecret(),
    { expiresIn: '24h' }
  );

  return {
    token,
    usuario: {
      id: usuario._id,
      NomApe: usuario.NomApe,
      email: usuario.email,
      rol: usuario.rol,
    },
  };
}

export async function logout(token) {
  if (typeof token !== 'string' || !token.trim()) {
    throw new ErrorAutenticacion('Token no provisto');
  }

  const tokenLimpio = token.trim();

  let payload;

  try {
    payload = jwt.verify(tokenLimpio, obtenerJwtSecret());
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      // Si el token ya venció naturalmente, ya no puede ser utilizado
      return { mensaje: 'Sesión cerrada exitosamente' };
    }
    throw new ErrorAutenticacion('Token inválido');
  }

  const expiraEn = new Date(payload.exp * 1000);

  try {
    await TokenRevocado.create({
      token: tokenLimpio,
      expiraEn,
    });
  } catch (error) {
    // Si ya había sido revocado previamente, la operación es idempotente y no falla
    if (error.code !== 11000) {
      throw error;
    }
  }

  return { mensaje: 'Sesión cerrada exitosamente' };
}

export async function esTokenRevocado(token) {
  if (typeof token !== 'string' || !token.trim()) {
    return false;
  }

  const existe = await TokenRevocado.exists({ token: token.trim() });
  return existe !== null;
}
