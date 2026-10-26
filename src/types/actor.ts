// ============================================================
//  actor.ts — Quién hace el pedido, para los services
// ============================================================
// Los services no reciben req: el controller les pasa un Actor (lo
// arma extraerActor, en utils/extraerActor.ts, a partir de req.auth). Vive
// fuera de services/ porque lo usan varios (clases, turnos) y ninguno
// es su dueño.

import type { Rol } from './roles.js';

export interface Actor {
  id: string;
  rol: Rol;
}
