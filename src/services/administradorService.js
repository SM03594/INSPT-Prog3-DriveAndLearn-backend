import Administrador from '../models/Administrador.js';
import { validarYHashearPassword } from './helpers/manejoDePassword.js';
import { validarMongooseObjId } from './helpers/validarMongooseObjId.js';

export async function crear(datos) {
  const passwordHasheada = await validarYHashearPassword(datos.password);

  return await Administrador.create({
    ...datos,
    password: passwordHasheada,
  });
}

export async function listar() {
  return await Administrador.find({});
}

export async function obtenerPorId(id) {
  validarMongooseObjId(id);

  return await Administrador.findById(id);
}

export async function actualizar(id, datos) {
  validarMongooseObjId(id);

  const datosActualizados = { ...datos };

  if (datosActualizados.password !== undefined) {
    const passwordHasheada = await validarYHashearPassword(datos.password);
    datosActualizados.password = passwordHasheada;
  }

  return await Administrador.findByIdAndUpdate(id, datosActualizados, {
    new: true,
    runValidators: true,
  });
}
