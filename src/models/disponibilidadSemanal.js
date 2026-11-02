import mongoose from 'mongoose';
import tramoSchema from './tramoHorario.js';

const disponibilidadSemanalSchema = new mongoose.Schema(
  {
    lunes: {
      type: [tramoSchema],
      default: [],
    },

    martes: {
      type: [tramoSchema],
      default: [],
    },

    miercoles: {
      type: [tramoSchema],
      default: [],
    },

    jueves: {
      type: [tramoSchema],
      default: [],
    },

    viernes: {
      type: [tramoSchema],
      default: [],
    },

    sabado: {
      type: [tramoSchema],
      default: [],
    },

    domingo: {
      type: [tramoSchema],
      default: [],
    },
  },

  {
    _id: false,
  }

);

export default disponibilidadSemanalSchema;
