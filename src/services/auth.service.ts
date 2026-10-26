import bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import * as usuarioService from './usuario.service.js';
import { TokenRevocadoModel } from '../models/TokenRevocado.js';
import { obtenerJwtSecret } from '../config/env.js';
import { ErrorAutenticacion } from '../errors/errorAutenticacion.js';
import { ErrorDeNegocio } from '../errors/errorDeNegocio.js';
import type { Rol } from '../types/roles.js';
import type { LoginDto } from '../dtos/auth.dto.js';

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

// "datos" ya es un LoginDto: que lleguen email y contraseña como texto
// lo validó el controller (ver dtos/auth.dto.ts). Un login mal armado
// es un 400; el 401 queda para credenciales que no coinciden.
export async function autenticar({ email, password }: LoginDto): Promise<ResultadoAutenticacion> {
  if (email.trim().length === 0 || password.length === 0) {
    throw new ErrorDeNegocio('Email y contraseña son obligatorios');
  }

  const usuario = await usuarioService.obtenerPorEmail(email);

  if (usuario === null || !(await bcrypt.compare(password, usuario.password))) {
    throw new ErrorAutenticacion(MENSAJE_CREDENCIALES_INVALIDAS);
  }

  const id = usuario._id.toString();
  const role = usuario.rol;
  const token = jwt.sign({ role }, obtenerJwtSecret(), {
    algorithm: 'HS256',
    audience: 'driveandlearn-api',
    expiresIn: '1h',
    issuer: 'driveandlearn',
    jwtid: randomUUID(),
    subject: id,
  });

  return {
    token,
    usuario: { id, email: usuario.email, nomApe: usuario.nomApe, role },
  };
}

function calcularHashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function tokenEstaRevocado(token: string): Promise<boolean> {
  const hash = calcularHashToken(token);
  const ahora = new Date();

  return (await TokenRevocadoModel.exists({
    hash,
    expiraEn: { $gt: ahora },
  })) !== null;
}

export async function revocarToken(token: string, exp: number): Promise<void> {
  const expiraEn = new Date(exp * 1000);

  if (!Number.isFinite(exp) || expiraEn.getTime() <= Date.now()) {
    throw new ErrorAutenticacion('Se requiere autenticación válida');
  }

  const hash = calcularHashToken(token);

  try {
    await TokenRevocadoModel.updateOne(
      { hash },
      { $setOnInsert: { expiraEn } },
      { upsert: true },
    );
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      return;
    }

    throw error;
  }
}
