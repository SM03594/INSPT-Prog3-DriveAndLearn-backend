import {
  type CalendarioSemanal,
  type Dia,
} from '../models/CalendarioSemanal.js';
import type { Tramo } from '../models/Tramo.js';
import { HorarioEscuelaModel } from '../models/HorarioEscuela.js';
import {
  agregarTramo as agregarTramoCalendario,
  quitarTramo as quitarTramoCalendario,
  validarDia,
  validarTramosEnPunto,
} from './calendarioSemanal.service.js';

function diaValido(dia: string): Dia {
  validarDia(dia);
  return dia;
}

export async function obtener(): Promise<CalendarioSemanal> {
  const horario = await HorarioEscuelaModel.findById('escuela');
  return horario?.calendario ?? {
    lunes: [],
    martes: [],
    miercoles: [],
    jueves: [],
    viernes: [],
    sabado: [],
    domingo: [],
  };
}

// "calendario" ya tiene los 7 días con su lista de tramos: lo garantiza
// el DTO (ver dtos/calendarioSemanal.dto.ts). Que cada tramo sea en
// punto lo revisa tramo.service; el resto de las horas, el esquema al
// hacer .save().
export async function reemplazar(
  calendario: CalendarioSemanal,
): Promise<CalendarioSemanal> {
  validarTramosEnPunto(calendario);
  const horario =
    (await HorarioEscuelaModel.findById('escuela')) ??
    new HorarioEscuelaModel({ _id: 'escuela' });
  horario.calendario = calendario;
  await horario.save();
  return horario.calendario;
}

export async function agregarTramo(
  dia: string,
  tramo: Tramo,
): Promise<CalendarioSemanal> {
  const horario =
    (await HorarioEscuelaModel.findById('escuela')) ??
    new HorarioEscuelaModel({ _id: 'escuela' });
  agregarTramoCalendario(horario.calendario, diaValido(dia), tramo);
  await horario.save();
  return horario.calendario;
}

export async function quitarTramo(
  dia: string,
  tramoId: string,
): Promise<CalendarioSemanal | null> {
  const horario = await HorarioEscuelaModel.findById('escuela');
  // Queda en null si todavía no se cargó el horario o si ese día no
  // tiene un tramo con ese _id.
  let calendarioActualizado: CalendarioSemanal | null = null;

  if (horario !== null) {
    const seQuitoElTramo = quitarTramoCalendario(
      horario.calendario,
      diaValido(dia),
      tramoId,
    );

    if (seQuitoElTramo) {
      await horario.save();
      calendarioActualizado = horario.calendario;
    }
  }

  return calendarioActualizado;
}
