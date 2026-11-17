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


// Impide que se altere la disponibilidad semanal desde el alta o edición general del perfil,
// forzando a que cualquier cambio de agenda pase exclusivamente por agregar/quitar tramos.
function verificarQueNoIncluyaDisponibilidad(datos) {
  if (datos && datos.disponibilidad !== undefined) {
    throw new ErrorDeNegocio(
      'La disponibilidad solo puede modificarse mediante agregarDisponibilidad y quitarDisponibilidad'
    );
  }
}


// Recibe una lista plana de elementos con la forma { dia, tramoHorario: { horaInicio, horaFin } }
// (ej. [{ dia: 'lunes', tramoHorario: { horaInicio: '08:00', horaFin: '12:00' } }]) y los agrupa
// en un diccionario indexado por día (ej. { lunes: [{ horaInicio, horaFin }] }) para procesar cada día en lote.
function agruparTramosPorDia(listaTramos) {
  return listaTramos.reduce((acumulador, { dia, tramoHorario }) => {
    if (!acumulador[dia]) {
      acumulador[dia] = [];
    }
    acumulador[dia].push(tramoHorario);
    return acumulador;
  }, {});
}


// Recupera el profesor por ID y lanza ErrorRegistroInexistente (404) si no existe;
// utilizado por operaciones compuestas (disponibilidad y turnos libres).
async function obtenerProfesorExistente(id) {
  const profesor = await obtenerPorId(id);

  if (!profesor) {
    throw new ErrorRegistroInexistente('El profesor solicitado no existe');
  }

  return profesor;
}


// Registra un nuevo profesor con disponibilidad semanal vacía por defecto de lunes a domingo.
export async function crear(datos) {
  verificarQueNoIncluyaDisponibilidad(datos);

  return await Profesor.create(datos);
}


// Retorna la totalidad de profesores registrados junto a su agenda semanal.
export async function listar() {
  return await Profesor.find({});
}


// Busca un profesor por su identificador único; retorna null si no existe para que
// el controlador devuelva 404 Not Found en operaciones CRUD directas.
export async function obtenerPorId(id) {
  validarMongooseObjId(id);

  return await Profesor.findById(id);
}


// Actualiza los datos personales del profesor (NomApe), aplicando validaciones del modelo
// y garantizando que no se introduzca el campo disponibilidad por esta vía.
export async function actualizar(id, datos) {
  validarMongooseObjId(id);
  verificarQueNoIncluyaDisponibilidad(datos);

  return await Profesor.findByIdAndUpdate(id, datos, {
    new: true,
    runValidators: true,
  });
}


// Retorna únicamente el subdocumento de disponibilidad semanal del docente especificado.
export async function verDisponibilidad(id) {
  const profesor = await obtenerProfesorExistente(id);

  return profesor.disponibilidad;
}


// Agrega tramos horarios a la disponibilidad del profesor, unificando automáticamente
// intervalos contiguos o superpuestos mediante Interval.merge() de Luxon.
export async function agregarDisponibilidad(id, listaTramos) {
  validarEntradaTramosDisponibilidad(listaTramos);

  const profesor = await obtenerProfesorExistente(id);
  const tramosPorDia = agruparTramosPorDia(listaTramos);

  // Itera exclusivamente sobre los días incluidos en la petición (tramosPorDia),
  // fusionando los nuevos tramos sin modificar los días no especificados.
  for (const [dia, nuevosTramos] of Object.entries(tramosPorDia)) {
    const tramosActuales = profesor.disponibilidad[dia] || [];
    profesor.disponibilidad[dia] = agregarTramosADia(
      tramosActuales,
      nuevosTramos
    );
  }

  return await profesor.save();
}


// Remueve o recorta tramos de disponibilidad del profesor utilizando Interval.difference(),
// recalculando los límites de los bloques afectados sin dejar huecos inconsistentes.
export async function quitarDisponibilidad(id, listaTramos) {
  validarEntradaTramosDisponibilidad(listaTramos);

  const profesor = await obtenerProfesorExistente(id);
  const tramosPorDia = agruparTramosPorDia(listaTramos);

  // Itera exclusivamente sobre los días incluidos en la petición (tramosPorDia),
  // recortando o quitando tramos sin modificar los días no especificados.
  for (const [dia, tramosAQuitar] of Object.entries(tramosPorDia)) {
    const tramosActuales = profesor.disponibilidad[dia] || [];
    profesor.disponibilidad[dia] = quitarTramosDeDia(
      tramosActuales,
      tramosAQuitar
    );
  }

  return await profesor.save();
}


// Excluye de los turnos posibles aquellos que se superponen con clases ya agendadas
// para el profesor en la fecha indicada.
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


// Identifica el día de la semana de la fecha consultada y proyecta sus tramos en bloques
// continuos de 1 hora exacta, descartando horas pasadas si la consulta es del día actual.
function obtenerTurnosPosibles(disponibilidad, fechaDateTime) {
  const nombreDia = obtenerDiaDeLaSemana(fechaDateTime);
  const tramosDelDia = disponibilidad?.[nombreDia] || [];

  if (tramosDelDia.length === 0) {
    return [];
  }

  return generarTurnosDeFecha(fechaDateTime, tramosDelDia);
}


// Orquesta la consulta de turnos libres de 1 hora del docente en una fecha dada:
// valida la fecha, proyecta la agenda del día, descarta turnos ocupados y adjunta autos disponibles.
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
