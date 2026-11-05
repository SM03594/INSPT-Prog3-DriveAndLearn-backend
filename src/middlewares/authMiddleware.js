import jwt from 'jsonwebtoken';
import { obtenerJwtSecret } from '../config/env.js';
import { ROLES } from '../constants/roles.js';
import ErrorAutenticacion from '../errors/ErrorAutenticacion.js';
import ErrorAutorizacion from '../errors/ErrorAutorizacion.js';
import TokenRevocado from '../models/TokenRevocado.js';


function validarJWT(token) {
  try {
    return jwt.verify(token, obtenerJwtSecret());
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new ErrorAutenticacion('Token expirado');
    }
    throw new ErrorAutenticacion('Token inválido');
  }
}


function autorizarRol(...rolesPermitidos) {
  return (req, _res, next) => {
    if (!req.usuario) {
      throw new ErrorAutenticacion('No autenticado');
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      throw new ErrorAutorizacion('No tiene permisos para acceder a este recurso');
    }

    next();
  };
}


export async function autenticar(req, _res, next) {
  const cabeceraAutorizacion = req.headers.authorization;

  if (!cabeceraAutorizacion || !cabeceraAutorizacion.startsWith('Bearer ')) {
    throw new ErrorAutenticacion('Token no provisto o formato inválido');
  }

  const token = cabeceraAutorizacion.slice(7).trim();

  if (!token) {
    throw new ErrorAutenticacion('Token no provisto');
  }

  const tokenEstaRevocado = await TokenRevocado.exists({ token });

  if (tokenEstaRevocado) {
    throw new ErrorAutenticacion('Token inválido o sesión cerrada');
  }

  const payloadVerificado = validarJWT(token);

  req.usuario = payloadVerificado;
  req.user = payloadVerificado;
  req.token = token;

  next();
}


export function verificarSiAdmin(req, res, next) {
  return autorizarRol(ROLES.ADMINISTRADOR)(req, res, next);
}
