import Alumno from '../models/Alumno.js';
import ErrorDeNegocio from '../errors/ErrorDeNegocio.js';
import ErrorSaldoClasesInsuficiente from '../errors/ErrorSaldoClasesInsuficiente.js';
import { validarYHashearPassword } from './helpers/manejoDePassword.js';
import { validarMongooseObjId } from './helpers/validarMongooseObjId.js';

export async function crear(datos) {
  const passwordHasheada = await validarYHashearPassword(datos.password);

  return await Alumno.create({
    ...datos,
    password: passwordHasheada,
  });
}

export async function listar() {
  return await Alumno.find({});
}

export async function obtenerPorId(id) {
  validarMongooseObjId(id);

  return await Alumno.findById(id);
}

export async function actualizar(id, datos) {
  validarMongooseObjId(id);

  const datosActualizados = { ...datos };

  if (datosActualizados.password !== undefined) {
    const passwordHasheada = await validarYHashearPassword(datos.password);
    datosActualizados.password = passwordHasheada;
  }

  return await Alumno.findByIdAndUpdate(id, datosActualizados, {
    new: true,
    runValidators: true,
  });
}

function validarYCalcularSaldo(saldoActual, cantidad, operacion) {
  if (typeof cantidad !== 'number' || !Number.isInteger(cantidad) || cantidad <= 0) {
    throw new ErrorDeNegocio(
      `La cantidad de clases a ${operacion} debe ser un número entero mayor a 0`
    );
  }

  const saldoResultante =
    operacion === 'sumar' ? saldoActual + cantidad : saldoActual - cantidad;

  if (saldoResultante < 0) {
    throw new ErrorSaldoClasesInsuficiente();
  }

  return saldoResultante;
}

export async function sumarSaldoClases(id, { cantidad }) {
  validarMongooseObjId(id);

  const alumno = await Alumno.findById(id);

  if (!alumno) {
    return null;
  }

  alumno.saldoClases = validarYCalcularSaldo(
    alumno.saldoClases,
    cantidad,
    'sumar'
  );

  return await alumno.save();
}

export async function restarSaldoClases(id, { cantidad }) {
  validarMongooseObjId(id);

  const alumno = await Alumno.findById(id);

  if (!alumno) {
    return null;
  }

  alumno.saldoClases = validarYCalcularSaldo(
    alumno.saldoClases,
    cantidad,
    'restar'
  );

  return await alumno.save();
}
