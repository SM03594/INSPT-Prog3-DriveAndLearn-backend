import Profesor from '../models/Profesor.js';
import ErrorDeNegocio from '../errors/ErrorDeNegocio.js';
import ErrorRegistroInexistente from '../errors/ErrorRegistroInexistente.js';
import { validarMongooseObjId } from './helpers/validarMongooseObjId.js';
import {
  validarEntradaTramosDisponibilidad,
  agregarTramosADia,
  quitarTramosDeDia,
} from './helpers/disponibilidadHelper.js';
import {
  parsearFechaConsulta,
  obtenerDiaDeLaSemana,
  generarTurnosDeFecha,
  seSuperponenIntervalos,
} from './helpers/turnosYFechasHelper.js';
import * as autoService from './autoService.js';
import * as claseService from './claseService.js';


function verificarQueNoIncluyaDisponibilidad(datos) {
  if (datos && datos.disponibilidad !== undefined) {
    throw new ErrorDeNegocio(
      'La disponibilidad solo puede modificarse mediante agregarDisponibilidad y quitarDisponibilidad'
    );
  }
}


function agruparTramosPorDia(listaTramos) {
  return listaTramos.reduce((acumulador, { dia, tramoHorario }) => {
    if (!acumulador[dia]) {
      acumulador[dia] = [];
    }
    acumulador[dia].push(tramoHorario);
    return acumulador;
  }, {});
}


async function obtenerProfesorExistente(id) {
  const profesor = await obtenerPorId(id);

  if (!profesor) {
    throw new ErrorRegistroInexistente('El profesor solicitado no existe');
  }

  return profesor;
}


export async function crear(datos) {
  verificarQueNoIncluyaDisponibilidad(datos);

  return await Profesor.create(datos);
}


export async function listar() {
  return await Profesor.find({});
}


export async function obtenerPorId(id) {
  validarMongooseObjId(id);

  return await Profesor.findById(id);
}


export async function actualizar(id, datos) {
  validarMongooseObjId(id);
  verificarQueNoIncluyaDisponibilidad(datos);

  return await Profesor.findByIdAndUpdate(id, datos, {
    new: true,
    runValidators: true,
  });
}


export async function verDisponibilidad(id) {
  const profesor = await obtenerProfesorExistente(id);

  return profesor.disponibilidad;
}


export async function agregarDisponibilidad(id, listaTramos) {
  validarEntradaTramosDisponibilidad(listaTramos);

  const profesor = await obtenerProfesorExistente(id);
  const tramosPorDia = agruparTramosPorDia(listaTramos);

  for (const [dia, nuevosTramos] of Object.entries(tramosPorDia)) {
    const tramosActuales = profesor.disponibilidad[dia] || [];
    profesor.disponibilidad[dia] = agregarTramosADia(
      tramosActuales,
      nuevosTramos
    );
  }

  return await profesor.save();
}


export async function quitarDisponibilidad(id, listaTramos) {
  validarEntradaTramosDisponibilidad(listaTramos);

  const profesor = await obtenerProfesorExistente(id);
  const tramosPorDia = agruparTramosPorDia(listaTramos);

  for (const [dia, tramosAQuitar] of Object.entries(tramosPorDia)) {
    const tramosActuales = profesor.disponibilidad[dia] || [];
    profesor.disponibilidad[dia] = quitarTramosDeDia(
      tramosActuales,
      tramosAQuitar
    );
  }

  return await profesor.save();
}


function filtrarTurnosOcupadosDelProfesor(turnos, clases, profesorId) {
  const profesorIdStr = profesorId.toString();
  const clasesDelProfesor = clases.filter(
    (clase) => clase.profesor.toString() === profesorIdStr
  );

  return turnos.filter(
    (turno) =>
      !clasesDelProfesor.some((clase) =>
        seSuperponenIntervalos(
          turno.inicio,
          turno.fin,
          clase.inicio,
          clase.fin
        )
      )
  );
}


function obtenerTurnosPosibles(disponibilidad, fechaDateTime) {
  const nombreDia = obtenerDiaDeLaSemana(fechaDateTime);
  const tramosDelDia = disponibilidad?.[nombreDia] || [];

  if (tramosDelDia.length === 0) {
    return [];
  }

  return generarTurnosDeFecha(fechaDateTime, tramosDelDia);
}


export async function obtenerTurnosLibres({ profesorId, fecha, cambios } = {}) {
  validarMongooseObjId(profesorId);

  const fechaDateTime = parsearFechaConsulta(fecha);
  const profesor = await obtenerProfesorExistente(profesorId);

  const turnosPosibles = obtenerTurnosPosibles(
    profesor.disponibilidad,
    fechaDateTime
  );

  if (turnosPosibles.length === 0) {
    return { turnos_libres: [] };
  }

  const clasesDelDia = await claseService.listarPorFecha(fecha.trim());
  const turnosLibresProfesor = filtrarTurnosOcupadosDelProfesor(
    turnosPosibles,
    clasesDelDia,
    profesorId
  );

  if (turnosLibresProfesor.length === 0) {
    return { turnos_libres: [] };
  }

  const turnos_libres = await autoService.adjuntarAutosATurnos(
    turnosLibresProfesor,
    cambios
  );

  return { turnos_libres };
}
