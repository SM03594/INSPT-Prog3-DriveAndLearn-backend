// ============================================================
//  errorDeNegocio.ts — Errores de negocio propios del proyecto
// ============================================================
// Un service puede fallar por dos motivos muy distintos:
//
//   1) una REGLA DE NEGOCIO rota (ej. "la cantidad no puede ser
//      negativa"): es un error ESPERADO, el cliente mandó algo que
//      no corresponde. Corresponde un 400.
//   2) un BUG real (ej. undefined.algo, la base caída): es un error
//      INESPERADO. Corresponde un 500, y conviene loguearlo.

export class ErrorDeNegocio extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = 'ErrorDeNegocio';
  }
}
