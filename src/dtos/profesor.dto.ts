// ============================================================
//  profesor.dto.ts — Lo que el cliente puede mandar sobre un profesor
// ============================================================
// Ver dtos/administrador.dto.ts para la idea general. Acá se valida
// la FORMA. Las reglas siguen en el service (el nombre no puede estar
// vacío, cómo se convierte la foto).

import { exigido, validarCampos } from '../utils/validacionCampos.js';

export interface CrearProfesorDto {
  nomApe: string;
}

export interface CambiarNomApeDto {
  nomApe: string;
}

export interface CambiarFotoDto {
  // Puede llegar como texto en base64, como bytes o como Buffer
  // serializado: la convierte el service (fotoComoBuffer).
  foto: unknown;
}

const CAMPO_NOM_APE = {
  nomApe: { tipo: 'string', nombre: 'El nombre y apellido' },
} as const;

const CAMPO_FOTO = {
  foto: { tipo: 'cualquiera', nombre: 'La foto' },
} as const;

const SIN_CAMPOS_DE_MAS = { mensajeNoPermitidos: 'No se pueden enviar estos campos' };

// ============================================================
//  aCrearProfesorDto — body del POST -> CrearProfesorDto
// ============================================================
// La disponibilidad no se manda al crear: arranca vacía.
export function aCrearProfesorDto(body: unknown): CrearProfesorDto {
  const datos = validarCampos(body, CAMPO_NOM_APE, SIN_CAMPOS_DE_MAS);
  return { nomApe: exigido(datos.nomApe, 'El nombre y apellido es obligatorio') };
}

// ============================================================
//  aCambiarNomApeDto — body de PATCH /profesores/:id/nom-ape
// ============================================================
export function aCambiarNomApeDto(body: unknown): CambiarNomApeDto {
  const datos = validarCampos(body, CAMPO_NOM_APE, SIN_CAMPOS_DE_MAS);
  return { nomApe: exigido(datos.nomApe, 'El nombre y apellido es obligatorio') };
}

// ============================================================
//  aCambiarFotoDto — body de PATCH /profesores/:id/foto-perfil
// ============================================================
// Antes, un body sin "foto" borraba la foto actual: ahora se exige.
export function aCambiarFotoDto(body: unknown): CambiarFotoDto {
  const datos = validarCampos(body, CAMPO_FOTO, SIN_CAMPOS_DE_MAS);
  return { foto: exigido(datos.foto, 'La foto es obligatoria') };
}

// La disponibilidad es un CalendarioSemanal: agregar y quitar un tramo
// usan los DTO compartidos con el horario de la escuela (ver
// dtos/calendarioSemanal.dto.ts).
