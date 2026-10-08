import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AdministradorModel } from '../models/Administrador.js';
import { AlumnoModel } from '../models/Alumno.js';
import { obtenerJwtSecret } from '../config/env.js';
import { ErrorAutenticacion } from '../errors/errorAutenticacion.js';

type RolUsuario = 'alumno' | 'administrador';

interface UsuarioAutenticado {
  id: string;
  email: string;
  nomApe: string;
  role: RolUsuario;
}

export interface ResultadoAutenticacion {
  token: string;
  usuario: UsuarioAutenticado;
}

const MENSAJE_CREDENCIALES_INVALIDAS = 'Email o contraseña incorrectos';

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

  const emailNormalizado = email.trim().toLowerCase();
  const [alumno, administrador] = await Promise.all([
    AlumnoModel.findOne({ email: emailNormalizado }),
    AdministradorModel.findOne({ email: emailNormalizado }),
  ]);

  const coincidencias: UsuarioAutenticado[] = [];
  const usuarios = [
    { usuario: alumno, role: 'alumno' },
    { usuario: administrador, role: 'administrador' },
  ] as const;

  for (const { usuario, role } of usuarios) {
    if (usuario !== null && await bcrypt.compare(password, usuario.password)) {
      coincidencias.push({
        id: usuario._id.toString(),
        email: usuario.email,
        nomApe: usuario.nomApe,
        role,
      });
    }
  }

  if (coincidencias.length !== 1) {
    throw new ErrorAutenticacion(MENSAJE_CREDENCIALES_INVALIDAS);
  }

  const { id, email: emailUsuario, nomApe, role } = coincidencias[0];
  const token = jwt.sign({ role }, obtenerJwtSecret(), {
    algorithm: 'HS256',
    audience: 'driveandlearn-api',
    expiresIn: '1h',
    issuer: 'driveandlearn',
    subject: id,
  });

  return {
    token,
    usuario: { id, email: emailUsuario, nomApe, role },
  };
}
