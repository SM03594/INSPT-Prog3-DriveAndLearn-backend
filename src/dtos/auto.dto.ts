// ============================================================
//  auto.dto.ts — Lo que el cliente puede mandar sobre un auto
// ============================================================
// Ver dtos/administrador.dto.ts para la idea general. Acá se valida
// la FORMA, y "cambios" sale ya convertido a 'MANUAL' | 'AUTOMATICO'
// (parsearCambios). Las reglas del dato siguen en el esquema: las
// mayúsculas y el unique de la patente (y el enum de "cambios", como
// segunda barrera).
//
// "activo" se puede mandar al crear (un auto puede nacer fuera de
// servicio), pero después solo cambia por PATCH /autos/:id/activo.

import { CAMBIOS, type Cambios } from '../models/Auto.js';
import { ErrorDeNegocio } from '../errors/errorDeNegocio.js';
import {
  AL_MODIFICAR,
  SIN_CAMPOS_DE_MAS,
  exigido,
  validarCampos,
} from '../utils/validacionCampos.js';

export interface CrearAutoDto {
  patente: string;
  cambios: Cambios;
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

// Type guard: después del if, TypeScript ya sabe que el texto es un
// Cambios. El "as" solo amplía CAMBIOS a una lista de string para
// poder buscar en ella cualquier texto.
function esCambios(texto: string): texto is Cambios {
  const esValido = (CAMBIOS as readonly string[]).includes(texto);
  return esValido;
}

// ============================================================
//  parsearCambios — texto del body -> 'MANUAL' | 'AUTOMATICO'
// ============================================================
// Acepta minúsculas ("manual"), igual que el uppercase del esquema.
// undefined pasa tal cual: lo obligatorio lo decide cada DTO con
// exigido(). Lo usan este DTO y el de la consulta de turnos.
export function parsearCambios(valor: string | undefined): Cambios | undefined {
  let cambios: Cambios | undefined;

  if (valor !== undefined) {
    const enMayusculas = valor.toUpperCase();
    if (!esCambios(enMayusculas)) {
      throw new ErrorDeNegocio('El tipo de cambios debe ser MANUAL o AUTOMATICO');
    }
    cambios = enMayusculas;
  }

  return cambios;
}

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
    cambios: exigido(parsearCambios(datos.cambios), 'El tipo de cambios es obligatorio'),
  };
}

// ============================================================
//  aActualizarAutoDto — body del PUT -> ActualizarAutoDto
// ============================================================
// Sin "activo" ni operadores como $set: el estado tiene su propia ruta.
// "cambios" solo se agrega si vino: así el update no lleva la clave
// con undefined.
export function aActualizarAutoDto(body: unknown): ActualizarAutoDto {
  const { cambios, ...resto } = validarCampos(body, CAMPOS_DATOS_AUTO, {
    ...AL_MODIFICAR,
    ayudaPorCampo: { activo: 'el estado se cambia con PATCH /autos/:id/activo' },
  });
  const datos: ActualizarAutoDto =
    cambios === undefined ? resto : { ...resto, cambios: parsearCambios(cambios) };

  return datos;
}

// ============================================================
//  aCambiarActivoDto — body de PATCH /autos/:id/activo
// ============================================================
// Un booleano de verdad: "false" como texto no sirve.
export function aCambiarActivoDto(body: unknown): CambiarActivoDto {
  const datos = validarCampos(body, CAMPO_ACTIVO, SIN_CAMPOS_DE_MAS);

  return { activo: exigido(datos.activo, 'El campo activo es obligatorio') };
}
