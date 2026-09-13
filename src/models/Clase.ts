// ============================================================
//  Clase.ts — Modelo Mongoose de la colección "clases"
// ============================================================

import { Schema, model, HydratedDocument, Types } from 'mongoose';

// ============================================================
//  Definición del esquema
// ============================================================
const claseSchema = new Schema(
  {
    alumno: {
      type: Schema.Types.ObjectId,
      required: [true, 'El alumno es obligatorio'],
      ref: 'Alumno',
    },

    profesor: {
      type: Schema.Types.ObjectId,
      required: [true, 'El profesor es obligatorio'],
      ref: 'Profesor',
    },

    auto: {
      type: Schema.Types.ObjectId,
      required: [true, 'El auto es obligatorio'],
      ref: 'Auto',
    },

    fecha: {
      type: String,
      required: [true, 'La fecha es obligatoria'],
      trim: true,
    },

    horaInicio: {
      type: String,
      required: [true, 'La hora de inicio es obligatoria'],
      trim: true,
    },

    horaFin: {
      type: String,
      required: [true, 'La hora de fin es obligatoria'],
      trim: true,
    },

    estado: {
      type: String,
      enum: {
        values: ['pendiente', 'confirmada', 'cancelada'],
        message: 'estado debe ser "pendiente", "confirmada" o "cancelada"',
      },
      default: 'pendiente',
    },
  },
  {
    timestamps: true,

    collection: 'clases',

    toJSON: {
      transform: (_doc, ret) => {
        delete (ret as Record<string, unknown>).__v;
        return ret;
      },
    },
  },
);

export interface Clase {
  alumno: Types.ObjectId;
  profesor: Types.ObjectId;
  auto: Types.ObjectId;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estado?: 'pendiente' | 'confirmada' | 'cancelada';
}

export type ClaseDoc = HydratedDocument<Clase>;

export const ClaseModel = model<Clase>('Clase', claseSchema);
