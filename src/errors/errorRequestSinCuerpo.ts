// ============================================================
//  errorRequestSinCuerpo.ts — Error de petición sin body
// ============================================================
// ErrorRequestSinCuerpo representa un pedido que necesitaba body y
// llegó sin él: no se mandó nada, o se mandó un body vacío. Lo lanza
// validacionDeCuerpo (middlewares/validacionDeCuerpo.middleware.ts).
//
// Es una subclase de ErrorPeticionInvalida (el cliente mandó algo
// con un formato que no corresponde), así que el errorHandler la
// responde con el mismo chequeo: 400 y su mensaje.

import { ErrorPeticionInvalida } from './errorPeticionInvalida.js';

export class ErrorRequestSinCuerpo extends ErrorPeticionInvalida {
  constructor(message = 'La petición debe incluir un cuerpo JSON') {
    super(message);
    this.name = 'ErrorRequestSinCuerpo';
  }
}
