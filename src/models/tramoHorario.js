import mongoose from 'mongoose';

const tramoSchema = new mongoose.Schema(
  {
    horaInicio: {
      type: String,
      required: [true, 'La hora de inicio es obligatoria'],
      trim: true,
      match: [
        /^([01]\d|2[0-3]):[0-5]\d$/,
        'La hora de inicio debe tener un formato HH:MM válido (00:00 a 23:59)',
      ],
    },

    horaFin: {
      type: String,
      required: [true, 'La hora de fin es obligatoria'],
      trim: true,
      match: [
        /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/,
        'La hora de fin debe tener un formato HH:MM válido (00:00 a 24:00)',
      ],
    },
  },

  {
    _id: false,
  }

);

export default tramoSchema;
