import mongoose from 'mongoose';
import Usuario from './Usuario.js';
import { ROLES } from '../constants/roles.js';

const alumnoSchema = new mongoose.Schema(
  {
    saldoClases: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'El saldo de clases no puede ser negativo'],
      validate: {
        validator: Number.isInteger,
        message: 'El saldo de clases debe ser un número entero',
      },
    },
  }

);

const Alumno = Usuario.discriminator('Alumno', alumnoSchema, ROLES.ALUMNO);

export default Alumno;
