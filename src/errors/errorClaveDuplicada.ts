// ============================================================
//  errorClaveDuplicada.ts — Error de índice unique violado
// ============================================================
// A diferencia de ErrorDeNegocio (que el service lanza directo ante una
// condición que él mismo evalúa, ej. "cantidad < 0"), a ErrorClaveDuplicada
// no la arma el service "a mano": se construye a partir del error CRUDO
// que tira Mongoose/MongoDB al repetir un valor que estaba marcado como
// unique.


import { ErrorDeNegocio } from './errorDeNegocio.js';

export class ErrorClaveDuplicada extends ErrorDeNegocio {
  constructor(message: string) {
    super(message, 409);
    this.name = 'ErrorClaveDuplicada';
  }
}


// ------------------------------------------------------------
//  comoErrorClaveDuplicada — traduce el error crudo de Mongo
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
//
// Es un TYPE GUARD: una función que devuelve boolean, pero con un tipo de
// retorno especial ("x is ErrorMongoDuplicado" en vez de "boolean" a
// secas). Gracias a eso, después de un `if (esErrorMongoDuplicado(algo))`,
// TypeScript "recuerda" adentro del if que `algo` es un ErrorMongoDuplicado
// (con `.code` disponible), en vez de seguir tratándolo como `unknown`.
// Es lo que le permite a comoErrorClaveDuplicada() leer `.code`/`.message`
// más abajo sin pelearse con el compilador.
//
// El cuerpo es un && de tres chequeos, evaluados de izquierda a derecha
// (si uno falla, ni se llega a evaluar el siguiente):
//   1) typeof x === 'object'  → descarta los primitivos (undefined,
//      string, number, boolean...). Un error de verdad también es
//      "object" en JS, así que esto no excluye al caso que buscamos.
//   2) x !== null             → typeof null TAMBIÉN es 'object' (una
//      rareza histórica de JS), así que hace falta descartarlo aparte.
//      Sin este chequeo, el paso 3 podría intentar leer ".code" de null.
//   3) (x as { code?: unknown }).code === 11000 → recién acá se lee la
//      propiedad. El "as { code?: unknown }" (type assertion) es
//      necesario porque "x" entró tipado como `unknown`: TypeScript no
//      deja leer NINGUNA propiedad de un `unknown` sin decirle antes
//      "tratalo como si tuviera, como mínimo, un campo code". Es una
//      promesa que se hace solo a nivel de tipos (no valida nada en
//      tiempo de ejecución) — por eso es seguro únicamente PORQUE los
//      pasos 1 y 2 ya garantizaron que "x" es un objeto no nulo.
function esErrorMongoDuplicado(x: unknown): x is ErrorMongoDuplicado {
  return typeof x === 'object' && x !== null && (x as { code?: unknown }).code === 11000;
}


export function comoErrorClaveDuplicada(err: unknown, mensajePorDefecto: string): unknown {
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
