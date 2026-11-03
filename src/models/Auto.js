import mongoose from 'mongoose';
import { CAMBIOS_ENUM } from '../constants/cambios.js';

const autoSchema = new mongoose.Schema(
  {
    marca: {
      type: String,
      required: [true, 'La marca es obligatoria'],
      trim: true,
    },

    modelo: {
      type: String,
      required: [true, 'El modelo es obligatorio'],
      trim: true,
    },

    patente: {
      type: String,
      required: [true, 'La patente es obligatoria'],
      unique: true,
      uppercase: true,
      trim: true,
      match: [
        /^([A-Z]{3}\d{3}|[A-Z]{2}\d{3}[A-Z]{2})$/,
        'La patente debe tener un formato válido en Argentina (ABC123 o AB123CD)',
      ],
    },

    cambios: {
      type: String,
      required: [true, 'El tipo de cambios es obligatorio'],
      uppercase: true,
      trim: true,
      enum: CAMBIOS_ENUM,
    },
  },

  {
    timestamps: true,

    collection: 'autos',

    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }

);

const Auto = mongoose.model('Auto', autoSchema);

export default Auto;
