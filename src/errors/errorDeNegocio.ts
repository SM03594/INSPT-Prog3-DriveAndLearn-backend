// ============================================================
//  errorDeNegocio.ts — Errores de negocio propios del proyecto
// ============================================================
// ErrorDeNegocio representa una REGLA DE NEGOCIO rota: un error
// ESPERADO, que el service detecta y decide cortar (ej. "la cantidad
// no puede ser negativa", "el auto no está disponible"). No es un bug:
// los bugs (undefined.algo, la base caída) no se lanzan a mano, y el
// errorHandler los responde con un 500.
//
// El status es 400 por defecto, pero quien lo lanza puede elegir otro
// 4xx: 404 si algo no existe, 409 si choca con el estado actual (un
// horario ocupado, una clase que ya comenzó).
//
// Tiene una subclase: ErrorClaveDuplicada (409, valor unique repetido).

export class ErrorDeNegocio extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = 'ErrorDeNegocio';
  }
}
