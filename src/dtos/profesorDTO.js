import ErrorDeTipo from '../errors/ErrorDeTipo.js';
import { validarEstructuraYTipos } from './helpers/validarEstructuraYTipos.js';

const TIPOS_CAMPOS_PROFESOR = Object.freeze({
    NomApe: 'string',
});

const CAMPOS_PROFESOR = ['NomApe'];

const TIPOS_CAMPOS_MODIFICAR_DISPONIBILIDAD = Object.freeze({
    tramos: 'object',
});

const CAMPOS_MODIFICAR_DISPONIBILIDAD = ['tramos'];

const TIPOS_CAMPOS_ITEM_DISPONIBILIDAD = Object.freeze({
    dia: 'string',
    tramoHorario: 'object',
});

const CAMPOS_ITEM_DISPONIBILIDAD = ['dia', 'tramoHorario'];

const TIPOS_CAMPOS_TRAMO_HORARIO = Object.freeze({
    horaInicio: 'string',
    horaFin: 'string',
});

const CAMPOS_TRAMO_HORARIO = ['horaInicio', 'horaFin'];


function validarItemDisponibilidad(item) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    throw new ErrorDeTipo(
        'Cada elemento de tramos debe ser un objeto válido'
    );
    }

    validarEstructuraYTipos(
        item,
        TIPOS_CAMPOS_ITEM_DISPONIBILIDAD,
        CAMPOS_ITEM_DISPONIBILIDAD,
        CAMPOS_ITEM_DISPONIBILIDAD
    );

    if (item.tramoHorario === null || Array.isArray(item.tramoHorario)) {
        throw new ErrorDeTipo('El campo tramoHorario debe ser un objeto válido');
    }

    validarEstructuraYTipos(
        item.tramoHorario,
        TIPOS_CAMPOS_TRAMO_HORARIO,
        CAMPOS_TRAMO_HORARIO,
        CAMPOS_TRAMO_HORARIO
    );
}


export function validarCrearProfesorDTO(body) {
    return validarEstructuraYTipos(
        body,
        TIPOS_CAMPOS_PROFESOR,
        CAMPOS_PROFESOR,
        CAMPOS_PROFESOR
    );
}


export function validarActualizarProfesorDTO(body) {
    return validarEstructuraYTipos(
        body,
        TIPOS_CAMPOS_PROFESOR,
        CAMPOS_PROFESOR
    );
}


export function validarModificarDisponibilidadDTO(body) {
    validarEstructuraYTipos(
        body,
        TIPOS_CAMPOS_MODIFICAR_DISPONIBILIDAD,
        CAMPOS_MODIFICAR_DISPONIBILIDAD,
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
