// ============================================================
//  roles.ts — Roles de usuario del sistema
// ============================================================
// Vive fuera de models/ para que cualquier capa (middlewares,
// services, tipos de Express) pueda usar los roles sin depender
// de la capa model. Usuario.ts lo importa para el enum del esquema.

export const ROLES = ['alumno', 'administrador'] as const;
export type Rol = (typeof ROLES)[number];
