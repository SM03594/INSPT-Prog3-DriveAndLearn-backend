import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as usuarioService from './usuario.service.js';
import { obtenerJwtSecret } from '../config/env.js';
import { ErrorAutenticacion } from '../errors/errorAutenticacion.js';
import type { Rol } from '../types/roles.js';

interface UsuarioAutenticado {
  id: string;
  email: string;
  nomApe: string;
  role: Rol;
}

export interface ResultadoAutenticacion {
  token: string;
  usuario: UsuarioAutenticado;
}

const MENSAJE_CREDENCIALES_INVALIDAS = 'Email o contraseña incorrectos';
// Mantener el costo (10) alineado con BCRYPT_ROUNDS en utils/password.ts.
const HASH_RELLENO =
  '$2b$10$i0iXBFkbnBL/NgkTXdPtrOIF3r6drWnxGLtK5oOJXajekALGPwFZ2';

export async function autenticar(
  email: unknown,
  password: unknown,
): Promise<ResultadoAutenticacion> {
  if (
    typeof email !== 'string' ||
    email.trim().length === 0 ||
    typeof password !== 'string' ||
    password.length === 0
  ) {
    throw new ErrorAutenticacion('Email y contraseña son obligatorios');
  }

  const usuario = await usuarioService.obtenerPorEmail(email);
  const hash = usuario?.password ?? HASH_RELLENO;
  const passwordValida = await bcrypt.compare(password, hash);

  if (usuario === null || !passwordValida) {
    throw new ErrorAutenticacion(MENSAJE_CREDENCIALES_INVALIDAS);
  }

  const id = usuario._id.toString();
  const role = usuario.rol;
  const token = jwt.sign({ role }, obtenerJwtSecret(), {
    algorithm: 'HS256',
    audience: 'driveandlearn-api',
    expiresIn: '1h',
    issuer: 'driveandlearn',
    subject: id,
  });

  return {
    token,
    usuario: { id, email: usuario.email, nomApe: usuario.nomApe, role },
  };
}
