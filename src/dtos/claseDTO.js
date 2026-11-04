import { validarEstructuraYTipos } from './helpers/validarEstructuraYTipos.js';

const TIPOS_CAMPOS_CLASE = Object.freeze({
  profesor: 'string',
  auto: 'string',
  inicio: 'string',
  fin: 'string',
});

const CAMPOS_REQUERIDOS_AGENDAR = Object.keys(TIPOS_CAMPOS_CLASE);

export function validarAgendarClaseDTO(cuerpoPeticion) {
  return validarEstructuraYTipos(
    cuerpoPeticion,
    TIPOS_CAMPOS_CLASE,
    CAMPOS_REQUERIDOS_AGENDAR
  );
}
