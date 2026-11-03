import mongoose from 'mongoose';

const tokenRevocadoSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: [true, 'El token es obligatorio'],
      unique: true,
      trim: true,
    },

    expiraEn: {
      type: Date,
      required: [true, 'La fecha de expiración es obligatoria'],
    },
  },

  {
    timestamps: true,

    collection: 'tokens_revocados',

    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Índice TTL (Time-To-Live): MongoDB elimina automáticamente el documento
// tan pronto como la fecha actual del sistema alcance o supere 'expiraEn'.
tokenRevocadoSchema.index({ expiraEn: 1 }, { expireAfterSeconds: 0 });

const TokenRevocado = mongoose.model('TokenRevocado', tokenRevocadoSchema);

export default TokenRevocado;

