import mongoose from 'mongoose';
import disponibilidadSemanalSchema from './disponibilidadSemanal.js';

const profesorSchema = new mongoose.Schema(
  {
    NomApe: {
      type: String,
      required: [true, 'El nombre y apellido del profesor es obligatorio'],
      trim: true,
      minlength: [4, 'El nombre y apellido debe tener al menos 4 caracteres'],
      maxlength: [50, 'El nombre y apellido debe tener maximo 50 caracteres']
    },

    disponibilidad: {
      type: disponibilidadSemanalSchema,
      required: [true, 'La disponibilidad del profesor es obligatoria'],
      default: () => ({}),
    },
  },

  {
    timestamps: true,

    collection: 'profesores',

    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }

);

const Profesor = mongoose.model('Profesor', profesorSchema);

export default Profesor;
