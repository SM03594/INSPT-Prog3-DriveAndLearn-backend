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


async function verificarSuperposiciones({ alumnoId, profesorId, autoId, inicio }) {
  const [claseAlumno, claseProfesor, claseAuto] = await Promise.all([
    Clase.exists({ alumno: alumnoId, inicio }),
    Clase.exists({ profesor: profesorId, inicio }),
    Clase.exists({ auto: autoId, inicio }),
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

  // Regla 1: Solo el propio alumno puede agendarse clases a sí mismo
  verificarPermisoAgendamiento(alumnoId, usuarioActual);

  // Regla de horario: La fecha debe ser futura y la clase durar exactamente 1 hora en punto
  verificarFechaFutura(inicio);
  validarIntervaloDeClase(inicio, fin);

  // Regla 0: Validar existencia de entidades (única responsabilidad: comprobar existencia)
  const { alumno, profesor } = await verificarEntidadesExistentes({
    alumnoId,
    profesorId,
    autoId,
  });

  // Validar que el alumno posea saldo disponible
  verificarSaldoSuficiente(alumno);

  // Regla 3: El horario debe estar dentro de la disponibilidad del profesor
  verificarDisponibilidadProfesor(profesor.disponibilidad, inicio, fin);

  // Reglas 2, 4 y 5: Verificar que ni alumno, ni profesor, ni auto tengan superposición
  await verificarSuperposiciones({
    alumnoId,
    profesorId,
    autoId,
    inicio,
  });

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


export async function listar(filtros = {}, usuarioActual) {
  const filtroFinal = { ...filtros };

  // Si el actor es alumno, solo puede visualizar sus propias clases
  if (usuarioActual?.rol === ROLES.ALUMNO) {
    filtroFinal.alumno = usuarioActual.id;
  }

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
