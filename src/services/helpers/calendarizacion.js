import { DateTime, Interval } from 'luxon';
import { DIAS_SEMANA, MAPA_WEEKDAY_DIA } from '../../constants/diasSemana.js';
import ErrorDeNegocio from '../../errors/ErrorDeNegocio.js';
import ErrorPeticionInvalida from '../../errors/ErrorPeticionInvalida.js';
import ErrorFormatoDeFecha from '../../errors/ErrorFormatoDeFecha.js';

// Expresión regular para validar horas en punto entre "00:00" y "24:00".
const REGEX_HORA_EN_PUNTO = /^(?:[01]\d|2[0-3]):00$|^24:00$/;

// Expresión regular para validar fechas ISO locales en hora en punto: "YYYY-MM-DDTHH:00".
const REGEX_FECHA_HORA_EN_PUNTO = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):00$/;

// Día arbitrario de referencia usado para proyectar tramos horarios de un mismo día
// en objetos Interval de Luxon y poder operar con ellos (merge, difference, length).
const DIA_BASE_REFERENCIA = DateTime.fromISO('2026-01-05T00:00');

// Constantes de reglas de negocio de horarios y duraciones.
const MIN_DURACION_TRAMO_HORAS = 1;
const DURACION_CLASE_HORAS = 1;
const HORA_CIERRE_DIA = '24:00';


// Valida que el string tenga formato "YYYY-MM-DDTHH:00" y sea una fecha real en el calendario,
// devolviendo una instancia DateTime de Luxon en hora local.
function parsearFechaHoraClase(fechaHoraStr) {
  if (
    typeof fechaHoraStr !== 'string' ||
    !REGEX_FECHA_HORA_EN_PUNTO.test(fechaHoraStr)
  ) {
    throw new ErrorFormatoDeFecha(
      'La fecha y hora de la clase debe tener el formato YYYY-MM-DDTHH:00 en punto'
    );
  }

  const fechaHora = DateTime.fromISO(fechaHoraStr);

  if (!fechaHora.isValid) {
    throw new ErrorFormatoDeFecha('La fecha y hora proporcionada no es válida');
  }

  return fechaHora;
}


// Verifica que una hora sea un string con formato en punto ":00" entre "00:00" y "24:00".
function esHoraEnPuntoValida(horaStr) {
  return typeof horaStr === 'string' && REGEX_HORA_EN_PUNTO.test(horaStr);
}


// Proyecta un tramo { horaInicio, horaFin } sobre la fecha de diaBaseDateTime y devuelve
// un Interval de Luxon. Si horaFin es "24:00", al sumar 24 horas al inicio del día,
// Luxon lo convierte automáticamente en las "00:00" del día siguiente.
function crearIntervaloDeTramo(diaBaseDateTime, tramo) {
  const inicioDia = diaBaseDateTime.startOf('day');
  const horasInicio = Number(tramo.horaInicio.split(':')[0]);
  const horasFin = Number(tramo.horaFin.split(':')[0]);

  const fechaInicio = inicioDia.plus({ hours: horasInicio });
  const fechaFin = inicioDia.plus({ hours: horasFin });

  return Interval.fromDateTimes(fechaInicio, fechaFin);
}


// Convierte un Interval de Luxon nuevamente a un objeto plano { horaInicio, horaFin }.
// Si el fin del intervalo coincide con las "00:00" del día siguiente a diaBaseDateTime,
// se restituye como "24:00" para mantener la convención de cierre de día.
function convertirIntervaloATramo(diaBaseDateTime, intervalo) {
  const inicioDiaSiguiente = diaBaseDateTime.startOf('day').plus({ days: 1 });
  const horaInicio = intervalo.start.toFormat('HH:mm');
  const horaFin = intervalo.end.equals(inicioDiaSiguiente)
    ? HORA_CIERRE_DIA
    : intervalo.end.toFormat('HH:mm');

  return { horaInicio, horaFin };
}


// Verifica que un tramo { horaInicio, horaFin } tenga ambas horas en punto válidas
// y que exista al menos 1 hora de distancia entre el inicio y el fin.
// Esto impide automáticamente que horaInicio sea "24:00" o que horaFin sea "00:00".
function validarTramoHorario(tramoHorario) {
  if (
    !tramoHorario ||
    typeof tramoHorario !== 'object' ||
    !esHoraEnPuntoValida(tramoHorario.horaInicio) ||
    !esHoraEnPuntoValida(tramoHorario.horaFin)
  ) {
    throw new ErrorFormatoDeFecha(
      'Las horas del tramo deben ser horas en punto válidas entre 00:00 y 24:00'
    );
  }

  const intervalo = crearIntervaloDeTramo(DIA_BASE_REFERENCIA, tramoHorario);

  if (!intervalo.isValid || intervalo.length('hours') < MIN_DURACION_TRAMO_HORAS) {
    throw new ErrorDeNegocio(
      `Debe existir al menos ${MIN_DURACION_TRAMO_HORAS} hora de distancia entre horaInicio y horaFin`
    );
  }
}


// Valida el array recibido por agregarDisponibilidad y quitarDisponibilidad:
// [{ dia: 'lunes', tramoHorario: { horaInicio: '08:00', horaFin: '14:00' } }, ...].
// Comprueba que no sea vacío, que cada día exista en DIAS_SEMANA y que cada tramo sea válido.
export function validarEntradaTramosDisponibilidad(listaTramos) {
  if (!Array.isArray(listaTramos) || listaTramos.length === 0) {
    throw new ErrorPeticionInvalida(
      'Se debe enviar una lista no vacía de tramos de disponibilidad'
    );
  }

  for (const item of listaTramos) {
    if (!item || typeof item !== 'object' || !DIAS_SEMANA.includes(item.dia)) {
      throw new ErrorPeticionInvalida(
        `El día debe ser uno de los siguientes: ${DIAS_SEMANA.join(', ')}`
      );
    }

    validarTramoHorario(item.tramoHorario);
  }
}


// Combina los tramos actuales de un día con los nuevos tramos utilizando Interval.merge()
// de Luxon, unificando automáticamente cualquier tramo superpuesto o contiguo
// (ej. 08:00-14:00 + 06:00-12:00 -> 06:00-14:00) y devolviéndolos ordenados.
export function agregarTramosADia(tramosExistentes, nuevosTramos) {
  const todosLosTramos = [...tramosExistentes, ...nuevosTramos];
  const intervalos = todosLosTramos.map((tramo) =>
    crearIntervaloDeTramo(DIA_BASE_REFERENCIA, tramo)
  );

  const intervalosUnificados = Interval.merge(intervalos);

  return intervalosUnificados.map((intervalo) =>
    convertirIntervaloATramo(DIA_BASE_REFERENCIA, intervalo)
  );
}


// Resta los tramosAQuitar de los tramosExistentes de un día utilizando interval.difference()
// de Luxon. Si el tramo a quitar está en el medio de un tramo existente, lo divide en dos
// (ej. 08:00-14:00 menos 10:00-12:00 -> 08:00-10:00 y 12:00-14:00).
export function quitarTramosDeDia(tramosExistentes, tramosAQuitar) {
  const intervalosExistentes = tramosExistentes.map((tramo) =>
    crearIntervaloDeTramo(DIA_BASE_REFERENCIA, tramo)
  );
  const intervalosAQuitar = tramosAQuitar.map((tramo) =>
    crearIntervaloDeTramo(DIA_BASE_REFERENCIA, tramo)
  );

  const intervalosResultantes = intervalosExistentes.flatMap(
    (intervaloExistente) => intervaloExistente.difference(...intervalosAQuitar)
  );

  return Interval.merge(intervalosResultantes).map((intervalo) =>
    convertirIntervaloATramo(DIA_BASE_REFERENCIA, intervalo)
  );
}


// Valida que el inicio y fin de una clase sean fechas en punto ("YYYY-MM-DDTHH:00")
// y que la duración entre ambas sea exactamente de 1 hora, devolviendo el Interval de Luxon.
export function validarIntervaloDeClase(inicioStr, finStr) {
  const fechaInicio = parsearFechaHoraClase(inicioStr);
  const fechaFin = parsearFechaHoraClase(finStr);
  const intervalo = Interval.fromDateTimes(fechaInicio, fechaFin);

  if (!intervalo.isValid || intervalo.length('hours') !== DURACION_CLASE_HORAS) {
    throw new ErrorDeNegocio(
      `La clase debe durar exactamente ${DURACION_CLASE_HORAS} hora`
    );
  }

  return intervalo;
}


// Verifica que la fecha y hora proporcionada sea estrictamente posterior al momento actual
// (o a una fechaReferencia provista, útil para tests deterministas).
export function verificarFechaFutura(fechaHoraStr, fechaReferencia = DateTime.now()) {
  const fechaHora = parsearFechaHoraClase(fechaHoraStr);

  if (fechaHora <= fechaReferencia) {
    throw new ErrorDeNegocio(
      'No se pueden agendar clases en fechas u horarios pasados'
    );
  }

  return fechaHora;
}

export const validarFechaFutura = verificarFechaFutura;


// Proyecta la disponibilidad semanal de un profesor sobre una ventana de 3 días
// (día anterior, día de referencia y día siguiente) y fusiona los intervalos contiguos
// con Interval.merge() para contemplar la continuidad en medianoche (24:00 -> 00:00).
function proyectarDisponibilidadEnVentana(
  disponibilidad,
  fechaReferenciaDateTime
) {
  const diaCentral = fechaReferenciaDateTime.startOf('day');
  const diasVentana = [
    diaCentral.minus({ days: 1 }),
    diaCentral,
    diaCentral.plus({ days: 1 }),
  ];

  const intervalos = diasVentana.flatMap((diaDateTime) => {
    const nombreDia = MAPA_WEEKDAY_DIA[diaDateTime.weekday];
    const tramosDelDia = disponibilidad?.[nombreDia] || [];

    return tramosDelDia.map((tramo) =>
      crearIntervaloDeTramo(diaDateTime, tramo)
    );
  });

  return Interval.merge(intervalos);
}


// Verifica si el horario de una clase (inicioStr a finStr) queda íntegramente contenido
// (bloque.engulfs) dentro de algún bloque de disponibilidad del profesor.
export function estaDentroDeDisponibilidad(disponibilidad, inicioStr, finStr) {
  const intervaloClase = validarIntervaloDeClase(inicioStr, finStr);
  const bloquesDisponibles = proyectarDisponibilidadEnVentana(
    disponibilidad,
    intervaloClase.start
  );

  return bloquesDisponibles.some((bloque) => bloque.engulfs(intervaloClase));
}


// Divide un Interval de Luxon en sub-intervalos de 1 hora exacta cada uno.
export function obtenerTurnosDeUnaHora(intervalo) {
  return intervalo.splitBy({ hours: DURACION_CLASE_HORAS });
}
