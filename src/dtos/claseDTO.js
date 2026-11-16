import ErrorDeTipo from '../errors/ErrorDeTipo.js';
import { validarEstructuraYTipos } from './helpers/validarEstructuraYTipos.js';


const TIPOS_CAMPOS_CLASE = Object.freeze({
  profesor: 'string',
  auto: 'string',
  inicio: 'string',
  fin: 'string',
});

// ===================================================================
// ===================================================================

const CAMPOS_REQUERIDOS_AGENDAR = Object.keys(TIPOS_CAMPOS_CLASE);

export function validarAgendarClaseDTO(cuerpoPeticion) {
  return validarEstructuraYTipos(
    cuerpoPeticion,
    TIPOS_CAMPOS_CLASE,
    CAMPOS_REQUERIDOS_AGENDAR
  );
}

// ===================================================================
// ===================================================================

const TIPOS_CAMPOS_LISTAR_QUERY = Object.freeze({
  profesor: 'string',
  auto: 'string',
  alumno: 'string',
  fecha: 'string',
});

const CAMPOS_REQUERIDOS_LISTAR_QUERY = [];
const CAMPOS_OPCIONALES_LISTAR_QUERY = Object.keys(TIPOS_CAMPOS_LISTAR_QUERY);

export function validarListarClasesQueryDTO(query) {
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    throw new ErrorDeTipo(
      'Los parámetros de consulta deben ser un objeto válido'
    );
  }

  const claves = Object.keys(query);
  let filtroObj = {};

  if (claves.length > 0) {
    filtroObj = validarEstructuraYTipos(
      query,
      TIPOS_CAMPOS_LISTAR_QUERY,
      CAMPOS_REQUERIDOS_LISTAR_QUERY,
      CAMPOS_OPCIONALES_LISTAR_QUERY
    );
  }

  return filtroObj;
}
