// ============================================================
//  errorJsonInvalido.ts — Error de body que no es un objeto JSON
// ============================================================
// ErrorJsonInvalido representa un body que llegó, pero que no es el
// objeto JSON que espera la API. Aparece en dos lugares:
//   - JSON mal escrito ('{"email": "a@b.com",'): lo rechaza
//     express.json() antes de llegar a cualquier router, y
//     comoErrorLecturaCuerpo (errorLecturaCuerpo.ts) traduce ese
//     error crudo a ErrorJsonInvalido.
//   - JSON bien escrito que no es un objeto (un array, []): lo
//     rechaza validacionDeCuerpo. (null, "texto" o 3 ni siquiera
//     llegan: express.json() solo acepta objetos y arrays, y los
//     trata como JSON mal escrito.)
//
// Es una subclase de ErrorPeticionInvalida, así que el errorHandler
// la responde con el mismo chequeo: 400 y su mensaje.

import { ErrorPeticionInvalida } from './errorPeticionInvalida.js';

export class ErrorJsonInvalido extends ErrorPeticionInvalida {
  constructor(message: string) {
    super(message);
    this.name = 'ErrorJsonInvalido';
  }
}
