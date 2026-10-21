// ============================================================
//  cuerpoPeticion.ts — Forma del body, para los controllers
// ============================================================
// Chequeo de la capa HTTP: ¿el pedido trajo un objeto JSON?
//
// Que el texto sea JSON bien escrito ya lo resolvió express.json()
// antes de llegar al controller (si no, ErrorLecturaCuerpo -> 400).
// Pero un JSON válido puede no ser un objeto ([], "texto", 3, null),
// y un pedido sin body llega con req.body === undefined (Express 5).
// Eso lo rechaza este helper.
//
// Qué campos trae el objeto, de qué tipo y qué reglas cumplen NO se
// mira acá: es trabajo del service.

import { ErrorPeticionInvalida } from '../errors/errorPeticionInvalida.js';

export function cuerpoComoObjeto(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ErrorPeticionInvalida('El cuerpo de la petición debe ser un objeto JSON');
  }
  return body as Record<string, unknown>;
}
