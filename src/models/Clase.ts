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

// ============================================================
//  Índices — para buscar superposiciones sin recorrer todo
// ============================================================
// La reserva y la consulta de turnos libres buscan las clases que se
// pisan con un período y que son de un profesor, de un alumno O de
// ciertos autos:
//   { inicio: { $lt: fin }, fin: { $gt: inicio }, $or: [profesor, auto, alumno] }
// Con un $or, MongoDB usa un índice distinto para cada rama, y si a
// UNA le falta, recorre la colección entera. Por eso hay tres.
//
// Primero el campo que se compara por igualdad, después "fin". Va "fin"
// y no "inicio" porque "fin > inicio pedido" descarta de una todas las
// clases que ya terminaron; con "inicio < fin pedido" el historial
// entero cumple la condición y habría que recorrerlo.
// Mongoose los crea solo al conectar.
claseSchema.index({ profesor: 1, fin: 1 });
claseSchema.index({ alumno: 1, fin: 1 });
claseSchema.index({ auto: 1, fin: 1 });

// Regla entre campos (validación a mano): el fin tiene que ser
// posterior al inicio. Igual que en tramoSchema (Tramo.ts), corre al
// validar el documento (create/save), no en findByIdAndUpdate.
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
}

export type ClaseDoc = HydratedDocument<Clase>;

export const ClaseModel = model<Clase>('Clase', claseSchema);
