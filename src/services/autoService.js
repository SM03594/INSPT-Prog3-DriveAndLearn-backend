import Auto from '../models/Auto.js';
import { CAMBIOS_ENUM } from '../constants/cambios.js';
import ErrorDeNegocio from '../errors/ErrorDeNegocio.js';
import { validarMongooseObjId } from './helpers/validarMongooseObjId.js';

export async function crear(datos) {
  return await Auto.create(datos);
}

export async function listar() {
  return await Auto.find({});
}

export async function listarActivos(cambios) {
  const filtro = { activo: true };

  if (cambios !== undefined) {
    const cambiosNormalizado =
      typeof cambios === 'string' ? cambios.trim().toUpperCase() : '';

    if (!CAMBIOS_ENUM.includes(cambiosNormalizado)) {
      throw new ErrorDeNegocio(
        'El tipo de cambios debe ser MANUAL o AUTOMATICO'
      );
    }

    filtro.cambios = cambiosNormalizado;
  }

  return await Auto.find(filtro);
}

export async function obtenerPorId(id) {
  validarMongooseObjId(id);

  return await Auto.findById(id);
}

export async function actualizar(id, datos) {
  validarMongooseObjId(id);

  return await Auto.findByIdAndUpdate(id, datos, {
    new: true,
    runValidators: true,
  });
}
