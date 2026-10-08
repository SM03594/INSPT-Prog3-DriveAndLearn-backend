import type { RequestHandler } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { obtenerJwtSecret } from '../config/env.js';
import { comoErrorAutenticacion } from '../errors/errorAutenticacion.js';

const MENSAJE_NO_AUTORIZADO = 'Se requiere autenticación válida';

function esPayloadAutenticado(payload: string | JwtPayload): payload is JwtPayload & {
  sub: string;
  role: 'alumno' | 'administrador';
} {
  return (
    typeof payload !== 'string' &&
    typeof payload.sub === 'string' &&
    (payload.role === 'alumno' || payload.role === 'administrador')
  );
}

export const requireAuthentication: RequestHandler = (req, res, next) => {
  const autorizacion = req.header('authorization');
  const coincidencia = autorizacion?.match(/^Bearer\s+(\S+)$/i);

  if (coincidencia === undefined || coincidencia === null) {
    return res.status(401).json({ mensaje: MENSAJE_NO_AUTORIZADO });
  }

  try {
    const payload = jwt.verify(coincidencia[1], obtenerJwtSecret(), {
      algorithms: ['HS256'],
      audience: 'driveandlearn-api',
      issuer: 'driveandlearn',
    });

    if (!esPayloadAutenticado(payload)) {
      return res.status(401).json({ mensaje: MENSAJE_NO_AUTORIZADO });
    }

    req.auth = { id: payload.sub, role: payload.role };
    return next();
  } catch (error) {
    return next(comoErrorAutenticacion(error, MENSAJE_NO_AUTORIZADO));
  }
};
