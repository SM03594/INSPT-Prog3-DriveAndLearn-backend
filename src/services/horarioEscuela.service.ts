import {
  DIAS,
  type CalendarioSemanal,
  type Dia,
} from '../models/CalendarioSemanal.js';
import { HorarioEscuelaModel } from '../models/HorarioEscuela.js';
import { ErrorDeNegocio } from '../errors/errorDeNegocio.js';
import {
  agregarTramo as agregarTramoCalendario,
  quitarTramo as quitarTramoCalendario,
  validarDia,
  validarTramo,
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

export async function reemplazar(
  valor: unknown,
): Promise<CalendarioSemanal> {
  if (
    typeof valor !== 'object' ||
    valor === null ||
    Array.isArray(valor) ||
    DIAS.some((dia) => !Array.isArray((valor as Record<string, unknown>)[dia]))
  ) {
    throw new ErrorDeNegocio('El calendario debe incluir una lista para cada día');
  }
  const calendario = valor as CalendarioSemanal;
  const horario =
    (await HorarioEscuelaModel.findById('escuela')) ??
    new HorarioEscuelaModel({ _id: 'escuela' });
  horario.calendario = calendario;
  await horario.save();
  return horario.calendario;
}

export async function agregarTramo(
  dia: string,
  tramo: unknown,
): Promise<CalendarioSemanal> {
  // Comprobar la entrada antes de leer o modificar el documento persistido.
  validarDia(dia);
  const calendarioTramo = validarTramo(tramo);
  const horario =
    (await HorarioEscuelaModel.findById('escuela')) ??
    new HorarioEscuelaModel({ _id: 'escuela' });
  // El helper compartido vuelve a validar antes de mutar el calendario.
  agregarTramoCalendario(horario.calendario, dia, calendarioTramo);
  await horario.save();
  return horario.calendario;
}

export async function quitarTramo(
  dia: string,
  tramoId: string,
): Promise<CalendarioSemanal | null> {
  const horario = await HorarioEscuelaModel.findById('escuela');
  if (horario === null) return null;

  const quitado = quitarTramoCalendario(
    horario.calendario,
    diaValido(dia),
    tramoId,
  );
  if (!quitado) return null;

  await horario.save();
  return horario.calendario;
}
