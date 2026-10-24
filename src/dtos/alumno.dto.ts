// ============================================================
//  alumno.dto.ts — Lo que el cliente puede mandar sobre un alumno
// ============================================================
// Ver dtos/administrador.dto.ts para la idea general. Acá se valida
// la FORMA: qué campos llegan y de qué tipo. Las reglas siguen en el
// service (saldo inicial en 0, cantidad entera y mayor que 0) y en el
// esquema (formato del email, unique).

import { exigido, validarCampos } from '../utils/validacionCampos.js';

export interface CrearAlumnoDto {
  email: string;
  password: string;
  nomApe: string;
}

// Al actualizar, cualquiera de los campos, pero al menos uno. El saldo
// no está: se cambia con sumar-clases / restar-clases.
export type ActualizarAlumnoDto = Partial<CrearAlumnoDto>;

export interface CantidadClasesDto {
  cantidad: number;
}

const CAMPOS_ALUMNO = {
  email: { tipo: 'string', nombre: 'El email' },
  password: { tipo: 'string', nombre: 'La contraseña' },
  nomApe: { tipo: 'string', nombre: 'El nombre y apellido' },
} as const;

const CAMPOS_CANTIDAD = {
  cantidad: { tipo: 'number', nombre: 'La cantidad' },
} as const;

// Si alguien intenta cambiar el saldo por PUT, se le dice dónde se hace.
const AYUDA_SALDO = {
  clasesPorReservar: 'el saldo de clases se cambia con sumar-clases / restar-clases',
};

// ============================================================
//  aCrearAlumnoDto — body del registro -> CrearAlumnoDto
// ============================================================
// clasesPorReservar no está en la tabla: si el cliente lo manda, se
// rechaza. El saldo inicial lo fija el service.
export function aCrearAlumnoDto(body: unknown): CrearAlumnoDto {
  const datos = validarCampos(body, CAMPOS_ALUMNO, {
    mensajeNoPermitidos: 'No se pueden enviar estos campos',
    ayudaPorCampo: AYUDA_SALDO,
  });

  return {
    email: exigido(datos.email, 'El email es obligatorio'),
    password: exigido(datos.password, 'La contraseña es obligatoria'),
    nomApe: exigido(datos.nomApe, 'El nombre y apellido es obligatorio'),
  };
}

// ============================================================
//  aActualizarAlumnoDto — body del PUT -> ActualizarAlumnoDto
// ============================================================
export function aActualizarAlumnoDto(body: unknown): ActualizarAlumnoDto {
  return validarCampos(body, CAMPOS_ALUMNO, {
    mensajeNoPermitidos: 'No se pueden modificar estos campos',
    alMenosUno: true,
    ayudaPorCampo: AYUDA_SALDO,
  });
}

// ============================================================
//  aCantidadClasesDto — body de sumar-clases / restar-clases
// ============================================================
// Que sea un entero mayor que 0 es una regla: la revisa el service.
export function aCantidadClasesDto(body: unknown): CantidadClasesDto {
  const datos = validarCampos(body, CAMPOS_CANTIDAD, {
    mensajeNoPermitidos: 'No se pueden enviar estos campos',
  });

  return { cantidad: exigido(datos.cantidad, 'La cantidad es obligatoria') };
}
