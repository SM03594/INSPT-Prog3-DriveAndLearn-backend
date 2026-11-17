import Clase from '../models/Clase.js';
import { ROLES } from '../constants/roles.js';
import ErrorDeNegocio from '../errors/ErrorDeNegocio.js';
import ErrorRegistroInexistente from '../errors/ErrorRegistroInexistente.js';
import ErrorSaldoClasesInsuficiente from '../errors/ErrorSaldoClasesInsuficiente.js';
import ErrorAutorizacion from '../errors/ErrorAutorizacion.js';
import { validarMongooseObjId } from './helpers/validarMongooseObjId.js';
import {
  validarIntervaloDeClase,
  estaDentroDeDisponibilidad,
  verificarFechaFutura,
  validarFechaCalendario,
  crearFiltroSuperposicion,
} from './helpers/turnosYFechasHelper.js';
import * as alumnoService from './alumnoService.js';
import * as profesorService from './profesorService.js';
import * as autoService from './autoService.js';


function verificarPermisoAgendamiento(alumnoId, usuarioActual) {
  // En esta etapa solo un alumno puede agendar clases para sí mismo.
  // Se estructura de forma modular por si en el futuro se habilita a los administradores.
  if (
    usuarioActual?.rol !== ROLES.ALUMNO ||
    usuarioActual?.id?.toString() !== alumnoId.toString()
  ) {
    throw new ErrorAutorizacion('Solo un alumno puede agendar clases para sí mismo');
  }
}


function verificarActorValido(
  alumnoIdClase,
  usuarioActual,
  mensaje = 'No tiene permisos para acceder a esta clase'
) {
  if (
    usuarioActual?.rol === ROLES.ALUMNO &&
    alumnoIdClase.toString() !== usuarioActual?.id?.toString()
  ) {
    throw new ErrorAutorizacion(mensaje);
  }
}


async function verificarEntidadesExistentes({ alumnoId, profesorId, autoId }) {
  // 1. Alumno
  const alumno = await alumnoService.obtenerPorId(alumnoId);
  if (!alumno) {
    throw new ErrorRegistroInexistente('El alumno solicitado no existe');
  }

  // 2. Profesor
  const profesor = await profesorService.obtenerPorId(profesorId);
  if (!profesor) {
    throw new ErrorRegistroInexistente('El profesor solicitado no existe');
  }

  // 3. Auto
  const auto = await autoService.obtenerPorId(autoId);
  if (!auto) {
    throw new ErrorRegistroInexistente('El auto solicitado no existe');
  }

  return { alumno, profesor, auto };
}


function verificarSaldoSuficiente(alumno) {
  if (alumno.saldoClases < 1) {
    throw new ErrorSaldoClasesInsuficiente(
      'El alumno no posee saldo de clases suficiente para agendar'
    );
  }
}


function verificarDisponibilidadProfesor(disponibilidad, inicio, fin) {
  const disponible = estaDentroDeDisponibilidad(disponibilidad, inicio, fin);

  if (!disponible) {
    throw new ErrorDeNegocio(
      'El horario seleccionado no se encuentra dentro de la disponibilidad del profesor'
    );
  }
}


async function verificarSuperposiciones(
  alumnoId,
  profesorId,
  autoId,
  inicio,
  fin
) {
  // Model.exists() retorna { _id: ... } si halla coincidencia o null si no;
  // se evalúan directamente como truthy/falsy en las condiciones posteriores.
  const [claseAlumno, claseProfesor, claseAuto] = await Promise.all([
    Clase.exists(crearFiltroSuperposicion(inicio, fin, { alumno: alumnoId })),
    Clase.exists(crearFiltroSuperposicion(inicio, fin, { profesor: profesorId })),
    Clase.exists(crearFiltroSuperposicion(inicio, fin, { auto: autoId })),
  ]);

  if (claseAlumno) {
    throw new ErrorDeNegocio(
      'El alumno ya posee una clase agendada en ese horario'
    );
  }

  if (claseProfesor) {
    throw new ErrorDeNegocio(
      'El profesor ya posee una clase asignada en ese horario'
    );
  }

  if (claseAuto) {
    throw new ErrorDeNegocio(
      'El auto seleccionado ya se encuentra asignado a otra clase en ese horario'
    );
  }
}


export async function agendar(datosClase, usuarioActual) {
  const { alumno: alumnoId, profesor: profesorId, auto: autoId, inicio, fin } =
    datosClase;

  // Validación previa de formato de identificadores
  validarMongooseObjId(alumnoId);
  validarMongooseObjId(profesorId);
  validarMongooseObjId(autoId);

  // Solo el propio alumno puede agendarse clases a sí mismo
  verificarPermisoAgendamiento(alumnoId, usuarioActual);

  // La fecha debe ser futura y la clase durar exactamente 1 hora en punto
  verificarFechaFutura(inicio);
  validarIntervaloDeClase(inicio, fin);

  // Validar existencia de entidades (única responsabilidad: comprobar existencia)
  const { alumno, profesor } = await verificarEntidadesExistentes({
    alumnoId,
    profesorId,
    autoId,
  });

  // Validar que el alumno posea saldo disponible
  verificarSaldoSuficiente(alumno);

  // El horario debe estar dentro de la disponibilidad del profesor
  verificarDisponibilidadProfesor(profesor.disponibilidad, inicio, fin);

  // Verificar que ni alumno, ni profesor, ni auto tengan superposición
  await verificarSuperposiciones(
    alumnoId,
    profesorId,
    autoId,
    inicio,
    fin
  );

  // Descontar saldo de clases al alumno vía alumnoService
  await alumnoService.restarSaldoClases(alumnoId, { cantidad: 1 });

  // Crear y persistir la nueva clase
  return await Clase.create({
    alumno: alumnoId,
    profesor: profesorId,
    auto: autoId,
    inicio,
    fin,
  });
}


export async function eliminar(idClase, usuarioActual) {
  validarMongooseObjId(idClase);

  const clase = await Clase.findById(idClase);

  if (!clase) {
    throw new ErrorRegistroInexistente('La clase solicitada no existe');
  }

  // Si el actor es alumno, solo puede eliminar sus propias clases
  verificarActorValido(
    clase.alumno,
    usuarioActual,
    'No tiene permisos para eliminar esta clase'
  );

  // Solo se pueden cancelar clases que no hayan comenzado
  verificarFechaFutura(
    clase.inicio,
    undefined,
    'No se pueden eliminar clases en fechas u horarios pasados'
  );

  // Reintegrar 1 crédito de saldo al alumno vía alumnoService
  await alumnoService.sumarSaldoClases(clase.alumno.toString(), { cantidad: 1 });

  // Eliminar la clase físicamente de la base de datos
  await Clase.findByIdAndDelete(idClase);

  return clase;
}


export async function obtenerPorId(idClase, usuarioActual) {
  validarMongooseObjId(idClase);

  const clase = await Clase.findById(idClase);

  if (!clase) {
    return null;
  }

  // Si el actor es alumno, solo puede consultar sus propias clases
  verificarActorValido(
    clase.alumno,
    usuarioActual,
    'No tiene permisos para acceder a esta clase'
  );

  return clase;
}


// Valida el formato semántico de los identificadores Mongoose y de la fecha recibidos
// como parámetros de consulta opcionales antes de evaluar permisos o construir el filtro.
function validarFormatosFiltros(filtros) {
  if (filtros.profesor !== undefined) {
    validarMongooseObjId(filtros.profesor);
  }

  if (filtros.auto !== undefined) {
    validarMongooseObjId(filtros.auto);
  }

  if (filtros.alumno !== undefined) {
    validarMongooseObjId(filtros.alumno);
  }

  if (filtros.fecha !== undefined) {
    validarFechaCalendario(filtros.fecha);
  }
}


// Si el actor es un alumno, restringe la consulta únicamente a su propio identificador.
// Impide explícitamente que consulte historiales o clases pertenecientes a otros alumnos.
function verificarPermisoConsultaAlumno(filtros, usuarioActual) {
  if (
    usuarioActual?.rol === ROLES.ALUMNO &&
    filtros.alumno !== undefined &&
    filtros.alumno.toString() !== usuarioActual?.id?.toString()
  ) {
    throw new ErrorAutorizacion(
      'No tienes permiso para acceder a clases de otros alumnos'
    );
  }
}


// Mapea los filtros ya validados y autorizados a la estructura de consulta de MongoDB.
// Si el actor es alumno, fija su ID en el filtro; si es administrador, permite filtrar por terceros.
function construirFiltroConsulta(filtros, usuarioActual) {
  const filtro = {};

  // Un alumno siempre consulta exclusivamente su propio historial
  if (usuarioActual?.rol === ROLES.ALUMNO) {
    filtro.alumno = usuarioActual.id;
  } else if (filtros.alumno !== undefined) {
    filtro.alumno = filtros.alumno;
  }

  if (filtros.profesor !== undefined) {
    filtro.profesor = filtros.profesor;
  }

  if (filtros.auto !== undefined) {
    filtro.auto = filtros.auto;
  }

  if (filtros.fecha !== undefined) {
    filtro.inicio = { $regex: `^${filtros.fecha}T` };
  }

  return filtro;
}


export async function listar(filtros = {}, usuarioActual) {
  validarFormatosFiltros(filtros);
  verificarPermisoConsultaAlumno(filtros, usuarioActual);

  const filtroFinal = construirFiltroConsulta(filtros, usuarioActual);

  return await Clase.find(filtroFinal);
}


// Obtiene todas las clases dictadas en una fecha dada (formato "YYYY-MM-DD").
// Se utiliza $regex con '^' porque 'inicio' se almacena como string con fecha y hora
// (ej. "YYYY-MM-DDTHH:00"), permitiendo traer todas las clases del día sin importar la hora.
export async function listarPorFecha(fecha) {
  return await Clase.find({
    inicio: { $regex: `^${fecha}T` },
  });
}


// Obtiene todas las clases que se superponen con el intervalo [inicio, fin).
// Permite especificar un filtro adicional opcional (ej. { auto: autoId }).
export async function listarEnIntervalo(inicio, fin, filtroAdicional = {}) {
  const filtro = crearFiltroSuperposicion(inicio, fin, filtroAdicional);
  return await Clase.find(filtro);
}
