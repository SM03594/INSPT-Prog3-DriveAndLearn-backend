import { validarEstructuraYTipos } from './helpers/validarEstructuraYTipos.js';

const TIPOS_CAMPOS_LOGIN = Object.freeze({
  email: 'string',
  password: 'string',
});

const CAMPOS_REQUERIDOS_LOGIN = Object.keys(TIPOS_CAMPOS_LOGIN);

export function validarLoginDTO(cuerpoPeticion) {
  return validarEstructuraYTipos(
    cuerpoPeticion,
    TIPOS_CAMPOS_LOGIN,
    CAMPOS_REQUERIDOS_LOGIN
  );
}

