// ============================================================
//  calendarioSemanal.dto.ts — Lo que el cliente puede mandar sobre un calendario
// ============================================================
// Un CalendarioSemanal es la misma forma para el horario de la escuela
// y para la disponibilidad de cada profesor (ver
// services/calendarioSemanal.service.ts). Por eso estos DTO los
// comparten los dos: agregar y quitar un tramo, y reemplazar la
// semana completa.
//
// Acá se valida la FORMA. Que el día exista lo revisa el service
// (validarDia), que cada tramo sea en punto, tramo.service, y el resto
// de las horas de cada tramo, el esquema al hacer .save().

import { DIAS, type CalendarioSemanal, type Dia } from '../models/CalendarioSemanal.js';
import type { Tramo } from '../models/Tramo.js';
import { ErrorDeNegocio } from '../errors/errorDeNegocio.js';
import { esObjetoJson } from '../utils/cuerpoPeticion.js';
import { SIN_CAMPOS_DE_MAS, exigido, validarCampos } from '../utils/validacionCampos.js';

export interface AgregarTramoDto {
  dia: string;
  tramo: Tramo;
}

export interface QuitarTramoDto {
  dia: string;
  tramoId: string;
}

// Los 7 días, cada uno con su lista de tramos.
export type ReemplazarCalendarioDto = CalendarioSemanal;

const CAMPOS_AGREGAR_TRAMO = {
  dia: { tipo: 'string', nombre: 'El día' },
  tramo: { tipo: 'objeto', nombre: 'El tramo' },
} as const;

const CAMPOS_QUITAR_TRAMO = {
  dia: { tipo: 'string', nombre: 'El día' },
  tramoId: { tipo: 'string', nombre: 'El identificador del tramo' },
} as const;

// Cómo se nombra cada día en los mensajes.
const NOMBRE_DIA = {
  lunes: 'El lunes',
  martes: 'El martes',
  miercoles: 'El miércoles',
  jueves: 'El jueves',
  viernes: 'El viernes',
  sabado: 'El sábado',
  domingo: 'El domingo',
} as const satisfies Record<Dia, string>;

const CAMPOS_CALENDARIO = Object.fromEntries(
  DIAS.map((dia) => [dia, { tipo: 'lista', nombre: NOMBRE_DIA[dia] }]),
) as { readonly [D in Dia]: { readonly tipo: 'lista'; readonly nombre: string } };

// ============================================================
//  aAgregarTramoDto — { dia, tramo } -> AgregarTramoDto
// ============================================================
// Se exige el tramo: un null guardado en el calendario rompe las
// reservas de ese día.
export function aAgregarTramoDto(body: unknown): AgregarTramoDto {
  const datos = validarCampos(body, CAMPOS_AGREGAR_TRAMO, SIN_CAMPOS_DE_MAS);

  return {
    dia: exigido(datos.dia, 'El día es obligatorio'),
    // Es un objeto, pero sus horas todavía no se revisaron: las valida
    // el esquema al hacer .save(). Por eso el "as".
    tramo: exigido(datos.tramo, 'El tramo es obligatorio') as Tramo,
  };
}

// ============================================================
//  aQuitarTramoDto — { dia, tramoId } -> QuitarTramoDto
// ============================================================
export function aQuitarTramoDto(body: unknown): QuitarTramoDto {
  const datos = validarCampos(body, CAMPOS_QUITAR_TRAMO, SIN_CAMPOS_DE_MAS);

  return {
    dia: exigido(datos.dia, 'El día es obligatorio'),
    tramoId: exigido(datos.tramoId, 'El identificador del tramo es obligatorio'),
  };
}

// ============================================================
//  aReemplazarCalendarioDto — la semana completa -> ReemplazarCalendarioDto
// ============================================================
// Los 7 días tienen que estar, cada uno con una lista, y cada elemento
// de la lista tiene que ser un objeto (un tramo): un null guardado en
// el calendario rompe las reservas de ese día. Un día que no existe
// ("feriado") se rechaza en vez de descartarse en silencio.
export function aReemplazarCalendarioDto(body: unknown): ReemplazarCalendarioDto {
  const datos = validarCampos(body, CAMPOS_CALENDARIO, SIN_CAMPOS_DE_MAS);

  const calendario = {} as CalendarioSemanal;
  for (const dia of DIAS) {
    const tramos = exigido(datos[dia], `${NOMBRE_DIA[dia]} es obligatorio`);
    // some y no every: every con un type guard estrecha el tipo a
    // Record<string, unknown>[], y ya no se podría convertir a Tramo[].
    // Las horas de cada tramo las valida el esquema al hacer .save().
    const hayTramosQueNoSonObjetos = tramos.some((tramo) => !esObjetoJson(tramo));

    if (hayTramosQueNoSonObjetos) {
      // "El martes" -> "martes", para armar "Cada tramo del martes...".
      const diaSinArticulo = NOMBRE_DIA[dia].slice('El '.length);
      throw new ErrorDeNegocio(`Cada tramo del ${diaSinArticulo} debe ser un objeto`);
    }
    calendario[dia] = tramos as Tramo[];
  }

  return calendario;
}
