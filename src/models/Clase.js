import mongoose from 'mongoose';

const claseSchema = new mongoose.Schema(
  {
    alumno: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Alumno',
      required: [true, 'El alumno es obligatorio'],
    },

    profesor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profesor',
      required: [true, 'El profesor es obligatorio'],
    },

    auto: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Auto',
      required: [true, 'El auto es obligatorio'],
    },

    inicio: {
      type: String,
      required: [true, 'La fecha y hora de inicio son obligatorias'],
      trim: true,
      match: [
        /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d$/,
        'El inicio debe tener un formato válido YYYY-MM-DDTHH:MM',
      ],
    },

    fin: {
      type: String,
      required: [true, 'La fecha y hora de fin son obligatorias'],
      trim: true,
      match: [
        /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d$/,
        'El fin debe tener un formato válido YYYY-MM-DDTHH:MM',
      ],
    },
  },

  {
    timestamps: true,

    collection: 'clases',

    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }

);

const Clase = mongoose.model('Clase', claseSchema);

export default Clase;
