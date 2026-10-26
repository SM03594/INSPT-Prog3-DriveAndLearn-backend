// ============================================================
//  Tramo.ts — Un tramo horario: de una hora de inicio a una de fin
// ============================================================
//   { horaInicio: { hora, minuto }, horaFin: { hora, minuto } }
//
// No es una colección: es un sub-esquema que se guarda dentro de los
// calendarios (ver CalendarioSemanal.ts). Las reglas de negocio de un
// tramo (por ejemplo, que sea en punto) están en
// services/tramo.service.ts.

import { Schema, Types } from 'mongoose';
import {
  horaDelDiaSchema,
  aMinutos,
  type HoraDelDia,
} from './Horario.js';

// ============================================================
//  Sub-esquema: un tramo
// ============================================================
export const tramoSchema = new Schema({
  horaInicio: {
    type: horaDelDiaSchema,
    required: [true, 'La hora de inicio es obligatoria'],
  },
  horaFin: {
    type: horaDelDiaSchema,
    required: [true, 'La hora de fin es obligatoria'],
  },
});

// Regla entre campos (validación a mano): el fin tiene que ser
// posterior al inicio. Corre al validar el subdocumento (o sea, al
// hacer .save() del documento que lo contiene).
tramoSchema.pre('validate', async function () {
  const inicio = this.get('horaInicio') as HoraDelDia | undefined;
  const fin = this.get('horaFin') as HoraDelDia | undefined;

  if (inicio && fin && aMinutos(inicio) >= aMinutos(fin)) {
    this.invalidate(
      'horaFin',
      'La hora de fin debe ser posterior a la de inicio',
    );
  }
});

// ============================================================
//  Tipo (para TypeScript) — escrito a mano
// ============================================================
export interface Tramo {
  _id?: Types.ObjectId; // lo genera Mongoose al agregar el tramo
  horaInicio: HoraDelDia;
  horaFin: HoraDelDia;
}
