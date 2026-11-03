import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Usuario from '../models/Usuario.js';
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

