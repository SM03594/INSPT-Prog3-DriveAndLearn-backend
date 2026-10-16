// ============================================================
//  errorAutorizacion.ts — Error de autorización
// ============================================================
// ErrorAutorizacion representa un pedido de alguien que SÍ está
// autenticado (sabemos quién es), pero que no tiene permiso para
// hacer lo que pide: un alumno queriendo ver a otro alumno, o un
// token de un administrador que ya fue borrado.
//
// Es la pareja de ErrorAutenticacion:
//   ErrorAutenticacion -> 401: no sabemos quién es.
//   ErrorAutorizacion  -> 403: sabemos quién es, pero no puede.
//
// Igual que ErrorAutenticacion, extiende directamente de Error (no
// es una regla de negocio) y siempre corresponde a un HTTP 403.

export class ErrorAutorizacion extends Error {
  readonly status = 403;

  constructor(message: string) {
    super(message);
    this.name = 'ErrorAutorizacion';
  }
}
