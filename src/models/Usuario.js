import mongoose from 'mongoose';
import { ROLES_ENUM } from '../constants/roles.js';

const usuarioSchema = new mongoose.Schema(
  {
    NomApe: {
      type: String,
      required: [true, 'El nombre y apellido es obligatorio'],
      trim: true,
      minlength: [4, 'El nombre y apellido debe tener al menos 4 caracteres'],
      maxlength: [50, 'El nombre y apellido debe tener maximo 50 caracteres']
    },

    email: {
      type: String,
      required: [true, 'El correo electrónico es obligatorio'],
      lowercase: true,
      unique: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Por favor, ingrese un correo electrónico válido',
      ],
    },

    password: {
      type: String,
      required: [true, 'La contraseña es obligatoria'],
    },

    rol: {
      type: String,
      required: [true, 'El rol es obligatorio'],
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
