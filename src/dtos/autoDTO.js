import { validarEstructuraYTipos } from './helpers/validarEstructuraYTipos.js';

const TIPOS_CAMPOS_AUTO = Object.freeze({
  marca: 'string',
  modelo: 'string',
  patente: 'string',
  cambios: 'string',
});

// ===================================================================
// ===================================================================

const CAMPOS_REQUERIDOS_CREAR = Object.keys(TIPOS_CAMPOS_AUTO);

export function validarCrearAutoDTO(body) {
  return validarEstructuraYTipos(
    body,
    TIPOS_CAMPOS_AUTO,
    CAMPOS_REQUERIDOS_CREAR
  );
}

// ===================================================================
// ===================================================================

const CAMPOS_REQUERIDOS_ACTUALIZAR = [];
const CAMPOS_OPCIONALES_ACTUALIZAR = Object.keys(TIPOS_CAMPOS_AUTO);

export function validarActualizarAutoDTO(body) {
  return validarEstructuraYTipos(
    body,
    TIPOS_CAMPOS_AUTO,
    CAMPOS_REQUERIDOS_ACTUALIZAR,
    CAMPOS_OPCIONALES_ACTUALIZAR
  );
}
