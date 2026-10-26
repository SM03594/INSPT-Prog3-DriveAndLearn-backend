// ============================================================
//  turno.dto.ts — Lo que el cliente puede mandar para consultar turnos
// ============================================================
// Body de POST /profesores/:id/turnos-libres, ya convertido: la fecha
// como día del calendario y las horas como { hora, minuto }, ambas en
// la hora de la escuela. No hay campo "alumno": la consulta muestra en
// qué horarios está libre el profesor, para cualquier rol.

import type { Cambios } from '../models/Auto.js';
import type { HoraDelDia } from '../models/Horario.js';
import type { FechaCalendario } from '../utils/fechas.js';

export interface ConsultarTurnosDto {
  fecha: FechaCalendario;
  // Sin "cambios", se ofrecen los autos activos de los dos tipos.
  cambios?: Cambios;
  // Sin "desde" o sin "hasta", el día no se recorta por ese lado.
  desde?: HoraDelDia;
  hasta?: HoraDelDia;
}
