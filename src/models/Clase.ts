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

    inicio: {
      type: Date,
      required: [true, 'El inicio de la clase es obligatorio'],
    },

    fin: {
      type: Date,
      required: [true, 'El fin de la clase es obligatorio'],
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

// Regla entre campos (validación a mano): el fin tiene que ser
// posterior al inicio. Igual que en tramoSchema (CalendarioSemanal.ts),
// corre al validar el documento (create/save), no en findByIdAndUpdate.
claseSchema.pre('validate', async function () {
  const inicio = this.get('inicio') as Date | undefined;
  const fin = this.get('fin') as Date | undefined;

  if (inicio && fin && inicio >= fin) {
    this.invalidate('fin', 'El fin de la clase debe ser posterior al inicio');
  }
});

export interface Clase {
  alumno: Types.ObjectId;
  profesor: Types.ObjectId;
  auto: Types.ObjectId;
  inicio: Date;
  fin: Date;
  estado?: 'pendiente' | 'confirmada' | 'cancelada';
}

export type ClaseDoc = HydratedDocument<Clase>;

export const ClaseModel = model<Clase>('Clase', claseSchema);
