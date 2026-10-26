// ============================================================
//  extraerActor.ts — Quién hace el pedido, para pasárselo a un service
// ============================================================
// Lo usan los controllers. Los services no reciben req: el controller
// les pasa un Actor (types/actor.ts), armado con lo que dejó
// requireAuthentication en req.auth. "role" es el nombre del dato en
// el token; el Actor usa "rol", como el resto del código.

import type { Request } from 'express';
import {
  ErrorAutenticacion,
  MENSAJE_NO_AUTORIZADO,
} from '../errors/errorAutenticacion.js';
import type { Actor } from '../types/actor.js';

export function extraerActor(req: Request): Actor {
  const auth = req.auth;

  // Solo pasa si la ruta se montó sin requireAuthentication antes.
  if (auth === undefined) {
    throw new ErrorAutenticacion(MENSAJE_NO_AUTORIZADO);
  }

  const actor: Actor = { id: auth.id, rol: auth.role };
  return actor;
}
