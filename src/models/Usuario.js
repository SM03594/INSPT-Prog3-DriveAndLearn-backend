import mongoose from 'mongoose';
import { ROLES_ENUM } from '../constants/roles.js';

const usuarioSchema = new mongoose.Schema(
  {
    NomApe: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Por favor, ingrese un correo electrónico válido',
      ],
    },

    password: {
      type: String,
      required: true,
    },

    rol: {
      type: String,
      required: true,
      enum: ROLES_ENUM,
    },
  },

  {
    timestamps: true,

    collection: 'usuarios',

    discriminatorKey: 'rol',
    
    toJSON: {
      transform: (doc, ret) => {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }

);

const Usuario = mongoose.model('Usuario', usuarioSchema);

export default Usuario;
