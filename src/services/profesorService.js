import Profesor from '../models/Profesor.js';
import ErrorDeNegocio from '../errors/ErrorDeNegocio.js';
import { validarMongooseObjId } from './helpers/validarMongooseObjId.js';

function verificarQueNoIncluyaDisponibilidad(datos) {
  if (datos && datos.disponibilidad !== undefined) {
    throw new ErrorDeNegocio(
      'La disponibilidad solo puede modificarse mediante agregarDisponibilidad y quitarDisponibilidad'
    );
  }
}

export async function crear(datos) {
  verificarQueNoIncluyaDisponibilidad(datos);

  return await Profesor.create(datos);
}

export async function listar() {
  return await Profesor.find({});
}

export async function obtenerPorId(id) {
  validarMongooseObjId(id);

  return await Profesor.findById(id);
}

export async function actualizar(id, datos) {
  validarMongooseObjId(id);
  verificarQueNoIncluyaDisponibilidad(datos);

  return await Profesor.findByIdAndUpdate(id, datos, {
    new: true,
    runValidators: true,
  });
}
