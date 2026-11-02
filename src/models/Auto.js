import mongoose from 'mongoose';
import { CAMBIOS_ENUM } from '../constants/cambios.js';

const autoSchema = new mongoose.Schema(
  {
    marca: {
      type: String,
      required: true,
      trim: true,
    },

    modelo: {
      type: String,
      required: true,
      trim: true,
    },

    patente: {
      type: String,
      required: true,
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
      required: true,
      uppercase: true,
      trim: true,
      enum: CAMBIOS_ENUM,
    },

    activo: {
      type: Boolean,
      default: true,
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
