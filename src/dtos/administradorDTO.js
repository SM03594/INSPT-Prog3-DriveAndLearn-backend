import { validarEstructuraYTipos } from './helpers/validarEstructuraYTipos.js';

const TIPOS_CAMPOS_ADMINISTRADOR = Object.freeze({
  NomApe: 'string',
  email: 'string',
  password: 'string',
});

const CAMPOS_REQUERIDOS_CREAR = ['NomApe', 'email', 'password'];
const CAMPOS_PERMITIDOS_CREAR = [...CAMPOS_REQUERIDOS_CREAR];

const CAMPOS_PERMITIDOS_ACTUALIZAR = ['NomApe', 'email', 'password'];

export function validarCrearAdministradorDTO(cuerpoPeticion) {
  return validarEstructuraYTipos(
    cuerpoPeticion,
    TIPOS_CAMPOS_ADMINISTRADOR,
    CAMPOS_PERMITIDOS_CREAR,
    CAMPOS_REQUERIDOS_CREAR
  );
}

export function validarActualizarAdministradorDTO(cuerpoPeticion) {
  return validarEstructuraYTipos(
    cuerpoPeticion,
    TIPOS_CAMPOS_ADMINISTRADOR,
    CAMPOS_PERMITIDOS_ACTUALIZAR
  );
}

