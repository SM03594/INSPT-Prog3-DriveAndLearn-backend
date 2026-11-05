import { DateTime, Interval, Settings } from 'luxon';
import { ZONA_HORARIA } from '../../config/env.js';
import { MAPA_WEEKDAY_DIA } from '../../constants/diasSemana.js';
import ErrorDeNegocio from '../../errors/ErrorDeNegocio.js';
import ErrorPeticionInvalida from '../../errors/ErrorPeticionInvalida.js';
import ErrorFormatoDeFecha from '../../errors/ErrorFormatoDeFecha.js';
import {
  crearIntervaloDeTramo,
  proyectarDisponibilidadEnVentana,
} from './disponibilidadHelper.js';
import {
  REGEX_FECHA_HORA_EN_PUNTO,
  REGEX_FECHA_DIA_YYYY_MM_DD,
  DURACION_CLASE_HORAS,
} from '../../constants/constantesCalendarizacion.js';

// Establece la zona horaria oficial de la escuela para todas las operaciones con Luxon.
Settings.defaultZone = ZONA_HORARIA;


// Valida que el string tenga formato "YYYY-MM-DDTHH:00" y sea una fecha real en el calendario,
// devolviendo una instancia DateTime de Luxon en hora local.
export function parsearFechaHoraClase(fechaHoraStr) {
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
export function verificarFechaFutura(
  fechaHoraStr,
  fechaReferencia = DateTime.now()
) {
  const fechaHora = parsearFechaHoraClase(fechaHoraStr);

  if (fechaHora <= fechaReferencia) {
    throw new ErrorDeNegocio(
      'No se pueden agendar clases en fechas u horarios pasados'
    );
  }

  return fechaHora;
}


// Divide un Interval de Luxon en sub-intervalos de 1 hora exacta cada uno.
export function obtenerTurnosDeUnaHora(intervalo) {
  return intervalo.splitBy({ hours: DURACION_CLASE_HORAS });
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


// Valida que la fecha provista sea un string en formato "YYYY-MM-DD", corresponda a un día real
// en el calendario y no sea una fecha pasada respecto al día actual (o fechaReferencia).
// Retorna un objeto con la instancia DateTime, la fecha en formato ISO y el nombre del día en español.
export function validarFechaConsulta(
  fechaStr,
  fechaReferencia = DateTime.now()
) {
  if (typeof fechaStr !== 'string' || fechaStr.trim() === '') {
    throw new ErrorPeticionInvalida('El parámetro fecha es obligatorio');
  }

  const fechaLimpia = fechaStr.trim();

  if (!REGEX_FECHA_DIA_YYYY_MM_DD.test(fechaLimpia)) {
    throw new ErrorFormatoDeFecha(
      'La fecha debe tener el formato YYYY-MM-DD y ser válida'
    );
  }

  const fechaDateTime = DateTime.fromISO(fechaLimpia);

  if (!fechaDateTime.isValid) {
    throw new ErrorFormatoDeFecha(
      'La fecha debe tener el formato YYYY-MM-DD y ser válida'
    );
  }

  if (fechaDateTime.startOf('day') < fechaReferencia.startOf('day')) {
    throw new ErrorDeNegocio(
      'No se pueden consultar turnos libres de fechas pasadas'
    );
  }

  const nombreDia = MAPA_WEEKDAY_DIA[fechaDateTime.weekday];

  return {
    fechaDateTime,
    fechaISO: fechaLimpia,
    nombreDia,
  };
}


// A partir de una fecha y una lista de tramos de disponibilidad [{ horaInicio, horaFin }],
// proyecta los tramos, los fusiona si hay superposiciones y los divide en turnos de 1 hora.
// Descarta automáticamente aquellos turnos cuyo inicio sea anterior o igual a fechaReferencia.
export function generarTurnosDeFecha(
  fecha,
  tramos = [],
  fechaReferencia = DateTime.now()
) {
  if (!Array.isArray(tramos) || tramos.length === 0) {
    return [];
  }

  const fechaDateTime =
    typeof fecha === 'string' ? DateTime.fromISO(fecha) : fecha;

  const intervalosTramos = tramos.map((tramo) =>
    crearIntervaloDeTramo(fechaDateTime, tramo)
  );

  const intervalosUnificados = Interval.merge(intervalosTramos);
  const turnos = [];

  for (const intervalo of intervalosUnificados) {
    const bloquesDeUnaHora = obtenerTurnosDeUnaHora(intervalo);

    for (const bloque of bloquesDeUnaHora) {
      if (bloque.start > fechaReferencia) {
        turnos.push({
          inicio: bloque.start.toFormat("yyyy-MM-dd'T'HH:mm"),
          fin: bloque.end.toFormat("yyyy-MM-dd'T'HH:mm"),
        });
      }
    }
  }

  return turnos;
}
