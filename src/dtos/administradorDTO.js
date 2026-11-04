import { validarEstructuraYTipos } from './helpers/validarEstructuraYTipos.js';

const TIPOS_CAMPOS_ADMINISTRADOR = Object.freeze({
  NomApe: 'string',
  email: 'string',
  password: 'string',
});

const CAMPOS_REQUERIDOS_CREAR = Object.keys(TIPOS_CAMPOS_ADMINISTRADOR);

const CAMPOS_OPCIONALES_ACTUALIZAR = Object.keys(TIPOS_CAMPOS_ADMINISTRADOR);

export function validarCrearAdministradorDTO(cuerpoPeticion) {
  return validarEstructuraYTipos(
    cuerpoPeticion,
    TIPOS_CAMPOS_ADMINISTRADOR,
    CAMPOS_REQUERIDOS_CREAR
  );
}

export function validarActualizarAdministradorDTO(cuerpoPeticion) {
  return validarEstructuraYTipos(
    cuerpoPeticion,
    TIPOS_CAMPOS_ADMINISTRADOR,
    [],
    CAMPOS_OPCIONALES_ACTUALIZAR
  );
}

