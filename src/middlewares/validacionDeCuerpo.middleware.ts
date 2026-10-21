// ============================================================
//  validacionDeCuerpo.middleware.ts — ¿El pedido trajo un objeto JSON?
// ============================================================
// Middleware para las rutas que necesitan body. Se monta en el
// router, después de los middlewares de autenticación (así un pedido
// sin token sigue respondiendo 401, y uno sin permiso 403):
//
// Rechaza:
//   - sin body, o con un body vacío      -> ErrorRequestSinCuerpo (400)
//   - un JSON que no es un objeto ([])   -> ErrorJsonInvalido (400)
//
// Que el JSON esté bien escrito no se mira acá: express.json() (en
// app.ts) lo lee antes de llegar a cualquier router, y si está mal
// escrito el error va directo al errorHandler (ver
// comoErrorLecturaCuerpo).
//
// Tampoco mira qué campos trae el objeto ni de qué tipo son: eso lo
// valida el service.

import type { Request, RequestHandler } from 'express';
import { ErrorJsonInvalido } from '../errors/errorJsonInvalido.js';
import { ErrorRequestSinCuerpo } from '../errors/errorRequestSinCuerpo.js';

// Type guard: ¿"valor" es un objeto JSON ({...})? Descarta null (typeof
// null también es 'object') y los arrays.
function esObjetoJson(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

// ============================================================
//  verificarCuerpo — el chequeo, para reutilizar
// ============================================================
// Lo usan validacionDeCuerpo y auth.middleware (verificarCamposPropios),
// para que los dos rechacen igual. Devuelve el body ya tipado como
// objeto.
//
// Sin body, Express 5 deja req.body en undefined. Pero si el cliente
// manda "Content-Type: application/json" con el body vacío,
// express.json() deja {}: por eso también se mira Content-Length.
export function verificarCuerpo(
  req: Pick<Request, 'body' | 'headers'>,
): Record<string, unknown> {
  const body: unknown = req.body;

  if (body === undefined || req.headers['content-length'] === '0') {
    throw new ErrorRequestSinCuerpo();
  }
  if (!esObjetoJson(body)) {
    throw new ErrorJsonInvalido('El cuerpo de la petición debe ser un objeto JSON');
  }

  return body;
}

export const validacionDeCuerpo: RequestHandler = (req, _res, next) => {
  verificarCuerpo(req);
  next();
};
