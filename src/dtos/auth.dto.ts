// ============================================================
//  auth.dto.ts — Lo que el cliente puede mandar para iniciar sesión
// ============================================================
// Ver dtos/administrador.dto.ts para la idea general. Un login mal
// armado (sin contraseña, con un email numérico) es un 400, como en el
// resto de la API. El 401 queda solo para credenciales que no
// coinciden (lo decide auth.service).

import { SIN_CAMPOS_DE_MAS, exigido, validarCampos } from '../utils/validacionCampos.js';

export interface LoginDto {
  email: string;
  password: string;
}

const CAMPOS_LOGIN = {
  email: { tipo: 'string', nombre: 'El email' },
  password: { tipo: 'string', nombre: 'La contraseña' },
} as const;

export function aLoginDto(body: unknown): LoginDto {
  const datos = validarCampos(body, CAMPOS_LOGIN, SIN_CAMPOS_DE_MAS);

  return {
    email: exigido(datos.email, 'El email es obligatorio'),
    password: exigido(datos.password, 'La contraseña es obligatoria'),
  };
}
