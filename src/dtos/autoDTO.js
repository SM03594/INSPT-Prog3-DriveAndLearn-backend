import { validarEstructuraYTipos } from './helpers/validarEstructuraYTipos.js';

const TIPOS_CAMPOS_AUTO = Object.freeze({
  marca: 'string',
  modelo: 'string',
  patente: 'string',
  cambios: 'string',
});

const CAMPOS_AUTO = ['marca', 'modelo', 'patente', 'cambios'];

export function validarCrearAutoDTO(body) {
  return validarEstructuraYTipos(
    body,
    TIPOS_CAMPOS_AUTO,
    CAMPOS_AUTO,
    CAMPOS_AUTO
  );
}

export function validarActualizarAutoDTO(body) {
  return validarEstructuraYTipos(body, TIPOS_CAMPOS_AUTO, CAMPOS_AUTO);
}
