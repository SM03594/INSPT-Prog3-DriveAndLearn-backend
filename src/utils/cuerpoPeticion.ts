// ============================================================
//  cuerpoPeticion.ts — Forma del body: ¿es un objeto JSON?
// ============================================================
// Lo usa utils/validacionCampos.ts, el helper de los DTO: así un body
// que no es un objeto se rechaza siempre igual (ErrorPeticionInvalida,
// 400), venga del endpoint que venga.
//
// Que el texto sea JSON bien escrito ya lo resolvió express.json()
// antes de llegar al controller (si no, ErrorLecturaCuerpo -> 400).
// Pero un JSON válido puede no ser un objeto ([], "texto", 3, null),
// y un pedido sin body llega con req.body === undefined (Express 5).
// Eso lo rechaza este helper.
//
// Qué campos trae el objeto y de qué tipo NO se mira acá: es trabajo
// del DTO (src/dtos/). Las reglas, del service.

import { ErrorPeticionInvalida } from '../errors/errorPeticionInvalida.js';

// Type guard: ¿"valor" es un objeto JSON ({...})? Descarta null (typeof
// null también es 'object') y los arrays. Lo usan cuerpoComoObjeto y los
// DTO, para los campos que tienen que ser un objeto (un tramo).
export function esObjetoJson(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

export function cuerpoComoObjeto(body: unknown): Record<string, unknown> {
  if (!esObjetoJson(body)) {
    throw new ErrorPeticionInvalida('El cuerpo de la petición debe ser un objeto JSON');
  }
  return body;
}
