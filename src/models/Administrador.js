import mongoose from 'mongoose';
import Usuario from './Usuario.js';
import { ROLES } from '../constants/roles.js';

const administradorSchema = new mongoose.Schema(
  {}
);

const Administrador = Usuario.discriminator(
  'Administrador',
  administradorSchema,
  ROLES.ADMINISTRADOR
);

export default Administrador;
