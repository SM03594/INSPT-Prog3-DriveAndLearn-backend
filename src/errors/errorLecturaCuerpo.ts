// ============================================================
//  errorLecturaCuerpo.ts — Error de body ilegible
// ============================================================
// ErrorLecturaCuerpo representa un body que no se pudo ni leer:
// JSON mal formado, demasiado grande, charset no soportado...
//
// Igual que ErrorClaveDuplicada, no se lanza "a mano": se construye
// a partir del error CRUDO que lanza express.json() (body-parser)
// ANTES de llegar a cualquier router. Ese error trae su propio status
// (400, 413, 415) y un "type" que dice qué pasó.
//
// Es una subclase de ErrorPeticionInvalida (el cliente mandó algo con
// un formato que no corresponde), así que el errorHandler la responde
// con el mismo chequeo, usando el status que trae.

import { ErrorPeticionInvalida } from './errorPeticionInvalida.js';

export class ErrorLecturaCuerpo extends ErrorPeticionInvalida {
  constructor(message: string, status: number) {
    super(message, status);
    this.name = 'ErrorLecturaCuerpo';
  }
}

// Mensaje propio, en castellano, para cada "type" de body-parser, en
// vez de reenviar el err.message en inglés (que además incluye
// detalles del parser).
const MENSAJES_CUERPO_INVALIDO: Record<string, string> = {
  'entity.parse.failed': 'El cuerpo de la petición no es un JSON válido',
  'entity.too.large': 'El cuerpo de la petición es demasiado grande',
  'charset.unsupported': 'La codificación de caracteres no está soportada',
  'encoding.unsupported': 'La codificación del contenido no está soportada',
};


function esErrorDeLecturaDelCuerpo(
  err: unknown,
): err is { status: number; type: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as { type?: unknown }).type === 'string' &&
    typeof (err as { status?: unknown }).status === 'number'
  );
}

// ------------------------------------------------------------
//  comoErrorLecturaCuerpo — traduce el error crudo de body-parser
// ------------------------------------------------------------
export function comoErrorLecturaCuerpo(err: unknown): unknown {
  let resultado: unknown = err;

  if (esErrorDeLecturaDelCuerpo(err) && err.status >= 400 && err.status < 500) {
    const mensaje =
      MENSAJES_CUERPO_INVALIDO[err.type] ?? 'El cuerpo de la petición es inválido';
    resultado = new ErrorLecturaCuerpo(mensaje, err.status);
  }

  return resultado;
}
