import { Interval, Settings } from 'luxon';
import { ZONA_HORARIA } from '../../config/env.js';
import { DIAS_SEMANA, MAPA_WEEKDAY_DIA } from '../../constants/diasSemana.js';
import ErrorDeNegocio from '../../errors/ErrorDeNegocio.js';
import ErrorPeticionInvalida from '../../errors/ErrorPeticionInvalida.js';
import ErrorFormatoDeFecha from '../../errors/ErrorFormatoDeFecha.js';
import {
  REGEX_HORA_EN_PUNTO,
  DIA_BASE_REFERENCIA,
  MIN_DURACION_TRAMO_HORAS,
  HORA_CIERRE_DIA,
} from '../../constants/constantesCalendarizacion.js';

// Establece la zona horaria oficial de la escuela para todas las operaciones con Luxon.
Settings.defaultZone = ZONA_HORARIA;

export { HORA_CIERRE_DIA };


// Verifica que una hora sea un string con formato en punto ":00" entre "00:00" y "24:00".
export function esHoraEnPuntoValida(horaStr) {
  return typeof horaStr === 'string' && REGEX_HORA_EN_PUNTO.test(horaStr);
}


// Proyecta un tramo { horaInicio, horaFin } sobre la fecha de diaBaseDateTime y devuelve
// un Interval de Luxon. Si horaFin es "24:00", al sumar 24 horas al inicio del día,
// Luxon lo convierte automáticamente en las "00:00" del día siguiente.
export function crearIntervaloDeTramo(diaBaseDateTime, tramo) {
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
export function convertirIntervaloATramo(diaBaseDateTime, intervalo) {
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
export function validarTramoHorario(tramoHorario) {
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


// Proyecta la disponibilidad semanal de un profesor sobre una ventana de 3 días
// (día anterior, día de referencia y día siguiente) y fusiona los intervalos contiguos
// con Interval.merge() para contemplar la continuidad en medianoche (24:00 -> 00:00).
export function proyectarDisponibilidadEnVentana(
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
