// ============================================================
//  errorAutenticacion.ts — Error de autenticación
// ============================================================
// ErrorAutenticacion representa un intento de autenticación rechazado.
// A diferencia de ErrorDeNegocio, es un error independiente: extiende
// directamente de Error y siempre corresponde a una respuesta HTTP 401.
//
// comoErrorAutenticacion traduce los errores crudos de jsonwebtoken al
// error propio del proyecto. Los errores que no son de JWT se devuelven
// sin modificar para que el middleware central los trate como inesperados.

import jwt from 'jsonwebtoken';

export class ErrorAutenticacion extends Error {
  readonly status = 401;

  constructor(message: string) {
    super(message);
    this.name = 'ErrorAutenticacion';
  }
}

export function comoErrorAutenticacion(
  err: unknown,
  mensajePorDefecto: string,
): unknown {
  if (err instanceof jwt.JsonWebTokenError) {
    return new ErrorAutenticacion(mensajePorDefecto);
  }

  return err;
}
