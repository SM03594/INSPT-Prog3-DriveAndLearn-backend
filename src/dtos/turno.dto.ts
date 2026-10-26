// ============================================================
//  turno.dto.ts — Lo que el cliente puede mandar para consultar turnos
// ============================================================
// Body de POST /profesores/:id/turnos-libres, ya convertido: la fecha
// como día del calendario y las horas como { hora, minuto }, ambas en
// la hora de la escuela. No hay campo "alumno": la consulta muestra en
// qué horarios está libre el profesor, para cualquier rol.
//
// Acá se valida la FORMA (cada dato por separado). Las reglas que
// comparan datos o dependen de hoy siguen en el service: que la fecha
// no sea pasada, que "desde" sea anterior a "hasta" y que el rango
// alcance para una clase.

import type { Cambios } from '../models/Auto.js';
import type { HoraDelDia } from '../models/Horario.js';
import {
  parsearFecha,
  parsearHoraDelDia,
  type FechaCalendario,
} from '../utils/fechas.js';
import {
  SIN_CAMPOS_DE_MAS,
  exigido,
  validarCampos,
} from '../utils/validacionCampos.js';
import { parsearCambios } from './auto.dto.js';

export interface ConsultarTurnosDto {
  fecha: FechaCalendario;
  // Sin "cambios", se ofrecen los autos activos de los dos tipos.
  cambios?: Cambios;
  // Sin "desde" o sin "hasta", el día no se recorta por ese lado.
  desde?: HoraDelDia;
  hasta?: HoraDelDia;
}

// Todos llegan como texto: "2026-11-09", "MANUAL", "08:00".
const CAMPOS_CONSULTA = {
  fecha: { tipo: 'string', nombre: 'La fecha' },
  cambios: { tipo: 'string', nombre: 'El tipo de cambios' },
  desde: { tipo: 'string', nombre: 'El desde' },
  hasta: { tipo: 'string', nombre: 'El hasta' },
} as const;

// ============================================================
//  aConsultarTurnosDto — body de POST /profesores/:id/turnos-libres
// ============================================================
// "alumno", "auto" o cualquier otro campo se rechazan, para todos los
// roles. Lo que no vino queda undefined.
export function aConsultarTurnosDto(body: unknown): ConsultarTurnosDto {
  const datos = validarCampos(body, CAMPOS_CONSULTA, SIN_CAMPOS_DE_MAS);
  const consulta: ConsultarTurnosDto = {
    fecha: exigido(parsearFecha(datos.fecha), 'La fecha es obligatoria'),
    cambios: parsearCambios(datos.cambios),
    desde: parsearHoraDelDia(datos.desde, 'El desde'),
    hasta: parsearHoraDelDia(datos.hasta, 'El hasta'),
  };

  return consulta;
}
