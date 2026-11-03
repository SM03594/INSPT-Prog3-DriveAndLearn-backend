import { validarEstructuraYTipos } from './helpers/validarEstructuraYTipos.js';

const TIPOS_CAMPOS_ALUMNO = Object.freeze({
  NomApe: 'string',
  email: 'string',
  password: 'string',
  saldoClases: 'number',
  cantidad: 'number',
});

const CAMPOS_REQUERIDOS_CREAR = ['NomApe', 'email', 'password'];
const CAMPOS_OPCIONALES_CREAR = ['saldoClases'];
const CAMPOS_PERMITIDOS_CREAR = [
  ...CAMPOS_REQUERIDOS_CREAR,
  ...CAMPOS_OPCIONALES_CREAR,
];

const CAMPOS_PERMITIDOS_ACTUALIZAR = ['NomApe', 'email', 'password'];

const CAMPOS_REQUERIDOS_MODIFICAR_SALDO = ['cantidad'];

export function validarCrearAlumnoDTO(body) {
  return validarEstructuraYTipos(
    body,
    TIPOS_CAMPOS_ALUMNO,
    CAMPOS_PERMITIDOS_CREAR,
    CAMPOS_REQUERIDOS_CREAR
  );
}

export function validarActualizarAlumnoDTO(body) {
  return validarEstructuraYTipos(
    body,
    TIPOS_CAMPOS_ALUMNO,
    CAMPOS_PERMITIDOS_ACTUALIZAR
  );
}

export function validarSumarSaldoClasesDTO(body) {
  return validarEstructuraYTipos(
    body,
    TIPOS_CAMPOS_ALUMNO,
    CAMPOS_REQUERIDOS_MODIFICAR_SALDO,
    CAMPOS_REQUERIDOS_MODIFICAR_SALDO
  );
}

export function validarRestarSaldoClasesDTO(body) {
  return validarEstructuraYTipos(
    body,
    TIPOS_CAMPOS_ALUMNO,
    CAMPOS_REQUERIDOS_MODIFICAR_SALDO,
    CAMPOS_REQUERIDOS_MODIFICAR_SALDO
  );
}
