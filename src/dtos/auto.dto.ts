// ============================================================
//  auto.dto.ts — Lo que el cliente puede mandar sobre un auto
// ============================================================
// Ver dtos/administrador.dto.ts para la idea general. Acá se valida
// la FORMA. Las reglas del dato siguen en el esquema: los valores
// permitidos de "cambios" (enum), mayúsculas y unique de la patente.
//
// "activo" se puede mandar al crear (un auto puede nacer fuera de
// servicio), pero después solo cambia por PATCH /autos/:id/activo.

import {
  AL_MODIFICAR,
  SIN_CAMPOS_DE_MAS,
  exigido,
  validarCampos,
} from '../utils/validacionCampos.js';

export interface CrearAutoDto {
  patente: string;
  cambios: string;
  marca?: string;
  modelo?: string;
  activo?: boolean;
}

// Al actualizar, cualquiera de los datos del auto, pero al menos uno.
export type ActualizarAutoDto = Partial<Omit<CrearAutoDto, 'activo'>>;

export interface CambiarActivoDto {
  activo: boolean;
}

const CAMPOS_DATOS_AUTO = {
  marca: { tipo: 'string', nombre: 'La marca' },
  modelo: { tipo: 'string', nombre: 'El modelo' },
  patente: { tipo: 'string', nombre: 'La patente' },
  cambios: { tipo: 'string', nombre: 'El tipo de cambios' },
} as const;

const CAMPO_ACTIVO = {
  activo: { tipo: 'boolean', nombre: 'El campo activo' },
} as const;

// ============================================================
//  aCrearAutoDto — body del POST -> CrearAutoDto
// ============================================================
// _id, createdAt, color... no están en la tabla: se rechazan, en vez de
// llegar a la base.
export function aCrearAutoDto(body: unknown): CrearAutoDto {
  const datos = validarCampos(
    body,
    { ...CAMPOS_DATOS_AUTO, ...CAMPO_ACTIVO },
    SIN_CAMPOS_DE_MAS,
  );

  return {
    ...datos,
    patente: exigido(datos.patente, 'La patente es obligatoria'),
    cambios: exigido(datos.cambios, 'El tipo de cambios es obligatorio'),
  };
}

// ============================================================
//  aActualizarAutoDto — body del PUT -> ActualizarAutoDto
// ============================================================
// Sin "activo" ni operadores como $set: el estado tiene su propia ruta.
export function aActualizarAutoDto(body: unknown): ActualizarAutoDto {
  return validarCampos(body, CAMPOS_DATOS_AUTO, {
    ...AL_MODIFICAR,
    ayudaPorCampo: { activo: 'el estado se cambia con PATCH /autos/:id/activo' },
  });
}

// ============================================================
//  aCambiarActivoDto — body de PATCH /autos/:id/activo
// ============================================================
// Un booleano de verdad: "false" como texto no sirve.
export function aCambiarActivoDto(body: unknown): CambiarActivoDto {
  const datos = validarCampos(body, CAMPO_ACTIVO, SIN_CAMPOS_DE_MAS);

  return { activo: exigido(datos.activo, 'El campo activo es obligatorio') };
}
