import mongoose from 'mongoose';

const profesorSchema = new mongoose.Schema(
  {
    NomApe: {
      type: String,
      required: true,
      trim: true,
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
