// ============================================================
//  auth.middleware.ts — Autenticación y autorización por JWT
// ============================================================
// Tres middlewares que los routers encadenan antes del controller:
//
//   requireAuthentication      -> ¿trae un JWT válido? (401 si no)
//   requireAdministrator       -> ¿es un administrador activo? (403 si no)
//   requireSelfOrAdministrator -> ¿es admin, o el dueño del recurso? (403 si no)
//
// Cómo rechazan: en vez de armar la respuesta acá (res.status().json()
// + return), LANZAN un error. En Express 5, un throw dentro de un
// middleware (sync o async) llega solo al errorHandler, que responde
// con err.status y { mensaje }. Así cada middleware es una lista de
// chequeos y termina en un único next() si todos pasan.


import type { RequestHandler } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { obtenerJwtSecret } from '../config/env.js';
import {
  ErrorAutenticacion,
  comoErrorAutenticacion,
} from '../errors/errorAutenticacion.js';
import { ErrorAutorizacion } from '../errors/errorAutorizacion.js';
import * as administradorService from '../services/administrador.service.js';
import { verificarCuerpo } from './validacionDeCuerpo.middleware.js';
import { ROLES, type Rol } from '../types/roles.js';

const MENSAJE_NO_AUTORIZADO = 'Se requiere autenticación válida';

// ============================================================
//  verificarToken — helper interno
// ============================================================
// Recibe el header "Authorization" completo y devuelve el payload
// del JWT. Lanza ErrorAutenticacion si el header no tiene la forma
// "Bearer <token>" o si jwt.verify rechaza el token.
function verificarToken(autorizacion: string | undefined): string | JwtPayload {
  const coincidencia = autorizacion?.match(/^Bearer\s+(\S+)$/i);

  if (coincidencia === undefined || coincidencia === null) {
    throw new ErrorAutenticacion(MENSAJE_NO_AUTORIZADO);
  }

  try {
    // Las mismas opciones con las que auth.service firma el token:
    // fijar el algoritmo evita aceptar tokens firmados con otro, y
    // audience/issuer descartan tokens emitidos para otra cosa.
    return jwt.verify(coincidencia[1], obtenerJwtSecret(), {
      algorithms: ['HS256'],
      audience: 'driveandlearn-api',
      issuer: 'driveandlearn',
    });
  } catch (error) {
    // Firma inválida, token vencido, etc.: comoErrorAutenticacion lo
    // convierte en ErrorAutenticacion (401). Si no es un error de
    // JWT, pasa tal cual y el errorHandler lo trata como un 500.
    throw comoErrorAutenticacion(error, MENSAJE_NO_AUTORIZADO);
  }
}

// ============================================================
//  esPayloadAutenticado — helper interno (type guard)
// ============================================================
// jwt.verify garantiza que el token lo firmamos nosotros y que no
// venció, pero tipa el payload como string | JwtPayload, con campos
// opcionales. Acá confirmamos que trae lo que auth.service puso al
// firmarlo: "sub" (el id del usuario) y un "role" conocido. Al ser
// un type guard, después del if TypeScript ya sabe que existen.
function esPayloadAutenticado(payload: string | JwtPayload): payload is JwtPayload & {
  sub: string;
  role: Rol;
} {
  return (
    typeof payload !== 'string' &&
    typeof payload.sub === 'string' &&
    ROLES.includes(payload.role)
  );
}

// ============================================================
//  verificarCamposPropios — helper interno
// ============================================================
// Cuando un usuario se edita a sí mismo, solo puede mandar los
// campos de "permitidos" (por ejemplo, un alumno no puede cambiarse
// clasesPorReservar). Si el body trae algún campo de más se rechaza
// el pedido entero, en vez de ignorarlo en silencio.
//
// "body" ya viene revisado por verificarCuerpo (el mismo chequeo de
// validacionDeCuerpo): este middleware corre antes que
// validacionDeCuerpo en la ruta, y así un alumno sin body recibe el
// mismo error que un administrador.
function verificarCamposPropios(
  body: Record<string, unknown>,
  permitidos: readonly string[],
): void {
  const camposNoPermitidos = Object.keys(body).filter(
    (campo) => !permitidos.includes(campo),
  );

  if (camposNoPermitidos.length > 0) {
    throw new ErrorAutorizacion(
      `No podés modificar estos campos: ${camposNoPermitidos.join(', ')}`,
    );
  }
}

// ============================================================
//  requireAuthentication — exige un JWT válido
// ============================================================
// Espera el header "Authorization: Bearer <token>". Si el token es
// válido, guarda { id, role } en req.auth (tipado en
// types/express.d.ts) y sigue. Si falta, está mal formado, tiene
// otra firma o venció, responde 401.
export const requireAuthentication: RequestHandler = (req, _res, next) => {
  const payload = verificarToken(req.header('authorization'));

  if (!esPayloadAutenticado(payload)) {
    throw new ErrorAutenticacion(MENSAJE_NO_AUTORIZADO);
  }

  req.auth = { id: payload.sub, role: payload.role };
  next();
};

// ============================================================
//  requireAdministrator — solo administradores activos
// ============================================================
// No alcanza con mirar el role del token: el JWT dura 1 hora, y si
// en ese tiempo se borra al administrador, su token sigue siendo
// válido. Por eso además se confirma que siga existiendo en la base.
export const requireAdministrator: RequestHandler = async (req, _res, next) => {
  const auth = req.auth;

  if (
    auth?.role !== 'administrador' ||
    !(await administradorService.existe(auth.id))
  ) {
    throw new ErrorAutorizacion('Se requieren permisos de administrador');
  }

  next();
};

// ============================================================
//  requireSelfOrAdministrator — admin, o el propio usuario
// ============================================================
// Para rutas con :id (ver/editar/borrar un usuario). Deja pasar:
//   - a un administrador activo, sobre cualquier :id y sin límites;
//   - al usuario cuyo id coincide con :id, es decir, sobre sí mismo.
//
// Es una fábrica: se llama al montar la ruta y devuelve el
// middleware. "camposEditablesPropios" limita qué campos del body
// puede mandar el usuario sobre sí mismo (ver verificarCamposPropios).
// Si no se pasa, no se revisa el body (rutas GET o DELETE).
//
//   router.put('/:id', requireSelfOrAdministrator(['email', 'nomApe']), ...)
export function requireSelfOrAdministrator(
  camposEditablesPropios?: readonly string[],
): RequestHandler {
  return async (req, _res, next) => {
    const auth = req.auth;

    // Solo pasa si se montó sin requireAuthentication antes.
    if (auth === undefined) {
      throw new ErrorAutenticacion(MENSAJE_NO_AUTORIZADO);
    }

    if (auth.role === 'administrador') {
      // Mismo chequeo que requireAdministrator: el token puede ser
      // de un administrador que ya fue borrado.
      if (!(await administradorService.existe(auth.id))) {
        throw new ErrorAutorizacion('La cuenta de administrador ya no está activa');
      }
    } else {
      if (auth.id !== req.params.id) {
        throw new ErrorAutorizacion('Solo podés acceder o modificar tu propio usuario');
      }

      if (camposEditablesPropios !== undefined) {
        verificarCamposPropios(verificarCuerpo(req), camposEditablesPropios);
      }
    }

    next();
  };
}
