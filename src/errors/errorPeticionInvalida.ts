// ============================================================
//  errorPeticionInvalida.ts — Error de petición mal armada
// ============================================================
// ErrorPeticionInvalida representa un pedido que no se puede ni
// empezar a procesar porque su forma está mal: por ejemplo, un body
// que no es un objeto JSON.
//
// No es lo mismo que ErrorDeNegocio: acá no se rompió ninguna regla
// del dominio (como "la cantidad no puede ser negativa"), sino que
// el cliente mandó algo con un formato que no corresponde.
//
// Extiende directamente de Error y siempre corresponde a un HTTP 400.

export class ErrorPeticionInvalida extends Error {
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = 'ErrorPeticionInvalida';
  }
}
