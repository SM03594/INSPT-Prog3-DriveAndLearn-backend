// ============================================================
//  clase.dto.ts — Lo que el cliente puede mandar sobre una clase
// ============================================================
// Ver dtos/administrador.dto.ts para la idea general. Acá se valida
// la FORMA. Todo lo demás sigue en el service: el formato de los ids
// y de las fechas, la duración, el horario, las superposiciones y el
// saldo.
//
// El contrato para reservar depende del ROL: un alumno reserva para
// sí mismo (no puede mandar "alumno"), un admin tiene que indicar para
// qué alumno reserva.

import type { Rol } from '../types/roles.js';
import {
  AL_MODIFICAR,
  SIN_CAMPOS_DE_MAS,
  exigido,
  validarCampos,
  type DatosValidados,
} from '../utils/validacionCampos.js';

export interface CrearClaseDto {
  profesor: string;
  auto: string;
  inicio: string;
  fin: string;
  // Solo cuando reserva un admin.
  alumno?: string;
}

// Al modificar, cualquiera de los datos de la reserva, pero al menos
// uno. El alumno de una clase no cambia.
export type ActualizarClaseDto = Partial<Omit<CrearClaseDto, 'alumno'>>;

const CAMPOS_RESERVA = {
  profesor: { tipo: 'string', nombre: 'El profesor' },
  auto: { tipo: 'string', nombre: 'El auto' },
  inicio: { tipo: 'string', nombre: 'El inicio' },
  fin: { tipo: 'string', nombre: 'El fin' },
} as const;

const CAMPOS_RESERVA_ADMIN = {
  ...CAMPOS_RESERVA,
  alumno: { tipo: 'string', nombre: 'El alumno' },
} as const;

// Los cuatro campos que siempre tiene una reserva.
function reservaDe(datos: DatosValidados<typeof CAMPOS_RESERVA>): CrearClaseDto {
  return {
    profesor: exigido(datos.profesor, 'El profesor es obligatorio'),
    auto: exigido(datos.auto, 'El auto es obligatorio'),
    inicio: exigido(datos.inicio, 'El inicio es obligatorio'),
    fin: exigido(datos.fin, 'El fin es obligatorio'),
  };
}

// ============================================================
//  aCrearClaseDto — body de POST /clases -> CrearClaseDto
// ============================================================
export function aCrearClaseDto(body: unknown, rol: Rol): CrearClaseDto {
  let reserva: CrearClaseDto;

  if (rol === 'administrador') {
    const datos = validarCampos(body, CAMPOS_RESERVA_ADMIN, SIN_CAMPOS_DE_MAS);
    reserva = { ...reservaDe(datos), alumno: exigido(datos.alumno, 'El alumno es obligatorio') };
  } else {
    // Para un alumno, "alumno" no está en la tabla: si lo manda, se rechaza.
    reserva = reservaDe(validarCampos(body, CAMPOS_RESERVA, SIN_CAMPOS_DE_MAS));
  }

  return reserva;
}

// ============================================================
//  aActualizarClaseDto — body de PUT /clases/:id -> ActualizarClaseDto
// ============================================================
// Ni "alumno" ni "estado" ni operadores como $set: el estado se cambia
// con PATCH /clases/:id/cancelar.
export function aActualizarClaseDto(body: unknown): ActualizarClaseDto {
  return validarCampos(body, CAMPOS_RESERVA, AL_MODIFICAR);
}
