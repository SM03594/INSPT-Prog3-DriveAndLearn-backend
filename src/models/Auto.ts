// ============================================================
//  Auto.ts — Modelo Mongoose de la colección "autos"
// ============================================================

import { Schema, model, HydratedDocument } from 'mongoose';

// --- Valores permitidos para "cambios" ---
export const CAMBIOS = ['automatico', 'manual'] as const;

// ============================================================
//  Definición del esquema
// ============================================================
const autoSchema = new Schema(
  {
    marca: {
      type: String,
      trim: true, // recorta espacios al principio/fin
    },

    modelo: {
      type: String,
      trim: true,
    },

    patente: {
      type: String,
      required: [true, 'La patente es obligatoria'],
      trim: true,
      uppercase: true,
      unique: true,
    },

    cambios: {
      type: String,
      required: [true, 'El tipo de cambios es obligatorio'],
      enum: {
        values: [...CAMBIOS],
        message: 'cambios debe ser "automatico" o "manual" (recibido: "{VALUE}")',
      },
    },

    activo: {
      type: Boolean,
      default: true,
    },
  },
  {
    // timestamps: agrega automáticamente createdAt y updatedAt.
    timestamps: true,

    collection: 'autos',

    toJSON: {
      transform: (_doc, ret) => {
        //res.json(auto): sacamos el __v (contador interno de versión de Mongoose) para no ensuciar la respuesta de la API.
        delete (ret as Record<string, unknown>).__v; 
        return ret;
      },
    },
  },
);


export interface Auto {
  marca: string;
  modelo: string;
  patente: string;
  cambios: string;
  activo: boolean;
}

// HydratedDocument = un documento "vivo" de Mongoose (con
// métodos como .save(), .toJSON(), y campos como _id), no un
// objeto plano.
export type AutoDoc = HydratedDocument<Auto>;

// ============================================================
//  El modelo
// ============================================================
// model('Auto', schema) crea (o recupera) el modelo. Mongoose
// pluraliza y pasa a minúsculas el nombre para la colección:
// "Auto" -> colección "autos" (que es justo lo que queremos).
export const AutoModel = model<Auto>('Auto', autoSchema);