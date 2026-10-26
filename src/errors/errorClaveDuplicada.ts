// ============================================================
//  errorClaveDuplicada.ts — Error de índice unique violado
// ============================================================
// Un valor marcado como unique que ya usa otro documento. Casi siempre
// se construye a partir del error CRUDO que tira Mongoose/MongoDB al
// repetirlo (verSiErrorClaveDuplicada, abajo). Un service también puede
// lanzarla "a mano" si busca el duplicado antes de guardar (ej.
// auto.service.ts): así el cliente recibe el mismo error por los dos
// caminos.

import { ErrorDeNegocio } from './errorDeNegocio.js';

export class ErrorClaveDuplicada extends ErrorDeNegocio {
  constructor(message: string) {
    super(message, 409);
    this.name = 'ErrorClaveDuplicada';
  }
}

// ------------------------------------------------------------
//  verSiErrorClaveDuplicada — traduce el error crudo de Mongo
// ------------------------------------------------------------
// El error "crudo" que tira MongoDB al violar un índice unique tiene la
// forma { code: 11000, keyValue: {...}, ... }. Puede llegar de dos formas
// distintas, según cómo esté definido el campo en el Schema:
//   - unique: true          -> err ES el error crudo.
//   - unique: [true, 'msg'] -> Mongoose envuelve el crudo en un
//                              MongooseError propio (con SU mensaje) y
//                              guarda el crudo en err.cause (la propiedad
//                              estándar de JS para "encadenar" un error
//                              dentro de otro).
type ErrorMongoDuplicado = { code: 11000 };

// esErrorMongoDuplicado — ¿"x" tiene forma de error de clave duplicada?
// Es un type guard: si devuelve true, TypeScript ya sabe que "x" tiene
// .code. Primero descarta los primitivos y null (typeof null también es
// 'object'); recién entonces lee .code. El "as" solo sirve para que
// TypeScript deje leer una propiedad de un unknown, y es seguro porque
// los dos chequeos anteriores garantizan que "x" es un objeto.
function esErrorMongoDuplicado(x: unknown): x is ErrorMongoDuplicado {
  return typeof x === 'object' && x !== null && (x as { code?: unknown }).code === 11000;
}

export function verSiErrorClaveDuplicada(err: unknown, mensajePorDefecto: string): unknown {
  // Arranca asumiendo que "err" no es un duplicado: si ningún caso de
  // abajo lo cambia, se devuelve tal cual llegó (único punto de salida).
  let resultado: unknown = err;

  if (err instanceof Error && esErrorMongoDuplicado(err.cause)) {
    // Caso "envuelto": el Schema ya redactó un mensaje propio (viene en
    // err.message), se usa tal cual.
    resultado = new ErrorClaveDuplicada(err.message);
  } else if (esErrorMongoDuplicado(err)) {
    // Caso "crudo" (unique: true a secas): no hay mensaje propio, se usa
    // el de respaldo que le pasó el service.
    resultado = new ErrorClaveDuplicada(mensajePorDefecto);
  }

  return resultado;
}
