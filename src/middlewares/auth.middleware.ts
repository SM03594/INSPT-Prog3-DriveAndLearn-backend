import type { RequestHandler } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { obtenerJwtSecret } from '../config/env.js';
import { comoErrorAutenticacion } from '../errors/errorAutenticacion.js';
import { AdministradorModel } from '../models/Administrador.js';

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

export const requireAdministrator: RequestHandler = async (req, res, next) => {
  const auth = req.auth;
  if (
    auth?.role !== 'administrador' ||
    await AdministradorModel.exists({ _id: auth.id }) === null
  ) {
    return res.status(403).json({
      mensaje: 'Se requieren permisos de administrador',
    });
  }

  return next();
};

export function requireSelfOrAdministrator(
  camposEditablesPropios?: readonly string[],
): RequestHandler {
  return async (req, res, next) => {
    const auth = req.auth;

    if (auth === undefined) {
      return res.status(401).json({ mensaje: MENSAJE_NO_AUTORIZADO });
    }

    if (auth.role === 'administrador') {
      if (await AdministradorModel.exists({ _id: auth.id }) === null) {
        return res.status(403).json({
          mensaje: 'La cuenta de administrador ya no está activa',
        });
      }
      return next();
    }

    if (auth.id !== req.params.id) {
      return res.status(403).json({
        mensaje: 'Solo podés acceder o modificar tu propio usuario',
      });
    }

    if (camposEditablesPropios !== undefined) {
      const body: unknown = req.body;

      if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        return res.status(400).json({
          mensaje: 'El cuerpo de la petición debe ser un objeto JSON',
        });
      }

      const camposNoPermitidos = Object.keys(body).filter(
        (campo) => !camposEditablesPropios.includes(campo),
      );

      if (camposNoPermitidos.length > 0) {
        return res.status(403).json({
          mensaje: `No podés modificar estos campos: ${camposNoPermitidos.join(', ')}`,
        });
      }
    }

    return next();
  };
}
