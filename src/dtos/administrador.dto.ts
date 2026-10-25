// ============================================================
//  administrador.dto.ts — Lo que el cliente puede mandar sobre un administrador
// ============================================================
// Un DTO (Data Transfer Object) es el CONTRATO de una operación: qué
// campos acepta y de qué tipo, separado del modelo (que describe lo que
// se guarda: rol, _id, timestamps, el hash de la contraseña...).
//
// Cada DTO tiene dos partes:
//   - el TIPO (CrearAdministradorDto), que usa TypeScript para que el
//     service reciba datos con la forma correcta;
//   - la FUNCIÓN que lo construye a partir del body (aCrearAdministradorDto),
//     que lo comprueba en runtime. La llama el controller: el service
//     recibe el DTO ya validado.
//
// Acá se valida la FORMA (qué campos y de qué tipo). Las reglas que
// dependen del dato siguen donde estaban: el formato del email y el
// unique en el esquema, el largo de la contraseña en conPasswordHasheada.

import {
  AL_MODIFICAR,
  SIN_CAMPOS_DE_MAS,
  exigido,
  validarCampos,
} from '../utils/validacionCampos.js';

export interface CrearAdministradorDto {
  email: string;
  password: string;
  nomApe: string;
}

// Al actualizar, cualquiera de los campos, pero al menos uno.
export type ActualizarAdministradorDto = Partial<CrearAdministradorDto>;

// Los campos del contrato, su tipo y cómo nombrarlos en los mensajes.
// rol, _id y los timestamps no están: si llegan, se rechazan.
const CAMPOS_ADMINISTRADOR = {
  email: { tipo: 'string', nombre: 'El email' },
  password: { tipo: 'string', nombre: 'La contraseña' },
  nomApe: { tipo: 'string', nombre: 'El nombre y apellido' },
} as const;

// ============================================================
//  aCrearAdministradorDto — body del POST -> CrearAdministradorDto
// ============================================================
// El tipo promete que los tres campos ESTÁN: por eso se exigen acá, y
// no se deja que lo descubra el esquema al guardar.
export function aCrearAdministradorDto(body: unknown): CrearAdministradorDto {
  const datos = validarCampos(body, CAMPOS_ADMINISTRADOR, SIN_CAMPOS_DE_MAS);

  return {
    email: exigido(datos.email, 'El email es obligatorio'),
    password: exigido(datos.password, 'La contraseña es obligatoria'),
    nomApe: exigido(datos.nomApe, 'El nombre y apellido es obligatorio'),
  };
}

// ============================================================
//  aActualizarAdministradorDto — body del PUT -> ActualizarAdministradorDto
// ============================================================
// Como solo pasan los campos de la tabla, un body con operadores de
// MongoDB ({ "$set": { "password": "..." } }) se rechaza acá y nunca
// llega a findByIdAndUpdate sin pasar por el hash.
export function aActualizarAdministradorDto(body: unknown): ActualizarAdministradorDto {
  return validarCampos(body, CAMPOS_ADMINISTRADOR, AL_MODIFICAR);
}
