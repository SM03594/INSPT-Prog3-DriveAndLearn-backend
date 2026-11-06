import ErrorDeTipo from '../errors/ErrorDeTipo.js';
import ErrorCampoInvalido from '../errors/ErrorCampoInvalido.js';
import { validarEstructuraYTipos } from './helpers/validarEstructuraYTipos.js';

const TIPOS_CAMPOS_PROFESOR = Object.freeze({
    NomApe: 'string',
});

const CAMPOS_PROFESOR = Object.keys(TIPOS_CAMPOS_PROFESOR);

const TIPOS_CAMPOS_TURNOS_LIBRES_QUERY = Object.freeze({
    fecha: 'string',
    cambios: 'string',
});

const CAMPOS_REQUERIDOS_TURNOS_LIBRES_QUERY = ['fecha'];
const CAMPOS_OPCIONALES_TURNOS_LIBRES_QUERY = ['cambios'];

const TIPOS_CAMPOS_MODIFICAR_DISPONIBILIDAD = Object.freeze({
    tramos: 'object',
});

const CAMPOS_MODIFICAR_DISPONIBILIDAD = Object.keys(
    TIPOS_CAMPOS_MODIFICAR_DISPONIBILIDAD
);

const TIPOS_CAMPOS_ITEM_DISPONIBILIDAD = Object.freeze({
    dia: 'string',
    tramoHorario: 'object',
});

const CAMPOS_ITEM_DISPONIBILIDAD = Object.keys(TIPOS_CAMPOS_ITEM_DISPONIBILIDAD);

const TIPOS_CAMPOS_TRAMO_HORARIO = Object.freeze({
    horaInicio: 'string',
    horaFin: 'string',
});

const CAMPOS_TRAMO_HORARIO = Object.keys(TIPOS_CAMPOS_TRAMO_HORARIO);


function validarItemDisponibilidad(item) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    throw new ErrorDeTipo(
        'Cada elemento de tramos debe ser un objeto válido'
    );
    }

    validarEstructuraYTipos(
        item,
        TIPOS_CAMPOS_ITEM_DISPONIBILIDAD,
        CAMPOS_ITEM_DISPONIBILIDAD
    );

    if (item.tramoHorario === null || Array.isArray(item.tramoHorario)) {
        throw new ErrorDeTipo('El campo tramoHorario debe ser un objeto válido');
    }

    validarEstructuraYTipos(
        item.tramoHorario,
        TIPOS_CAMPOS_TRAMO_HORARIO,
        CAMPOS_TRAMO_HORARIO
    );
}


export function validarCrearProfesorDTO(body) {
    return validarEstructuraYTipos(
        body,
        TIPOS_CAMPOS_PROFESOR,
        CAMPOS_PROFESOR
    );
}


export function validarActualizarProfesorDTO(body) {
    return validarEstructuraYTipos(
        body,
        TIPOS_CAMPOS_PROFESOR,
        [],
        CAMPOS_PROFESOR
    );
}


export function validarModificarDisponibilidadDTO(body) {
    validarEstructuraYTipos(
        body,
        TIPOS_CAMPOS_MODIFICAR_DISPONIBILIDAD,
        CAMPOS_MODIFICAR_DISPONIBILIDAD
    );

    if (!Array.isArray(body.tramos)) {
    throw new ErrorDeTipo('El campo tramos debe ser un array');
    }

    body.tramos.forEach(validarItemDisponibilidad);

    return body;
}

export const validarAgregarDisponibilidadDTO = validarModificarDisponibilidadDTO;
export const validarQuitarDisponibilidadDTO = validarModificarDisponibilidadDTO;


export function validarTurnosLibresQueryDTO(query) {
    if (!query || typeof query !== 'object' || Array.isArray(query)) {
        throw new ErrorDeTipo(
            'Los parámetros de consulta deben ser un objeto válido'
        );
    }

    const claves = Object.keys(query);
    if (claves.length === 0) {
        throw new ErrorCampoInvalido(
            'Los parámetros de consulta no pueden estar vacíos'
        );
    }

    return validarEstructuraYTipos(
        query,
        TIPOS_CAMPOS_TURNOS_LIBRES_QUERY,
        CAMPOS_REQUERIDOS_TURNOS_LIBRES_QUERY,
        CAMPOS_OPCIONALES_TURNOS_LIBRES_QUERY
    );
}
