import Auto from '../models/Auto.js';
import { CAMBIOS_ENUM } from '../constants/cambios.js';
import ErrorDeNegocio from '../errors/ErrorDeNegocio.js';
import { validarMongooseObjId } from './helpers/validarMongooseObjId.js';
import * as claseService from './claseService.js';


export async function crear(datos) {
  return await Auto.create(datos);
}


export async function listar(cambios) {
  const filtro = {};

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


export async function obtenerAutosLibresEnTurno(inicio, cambios) {
  const [flotaAutos, clasesEnHorario] = await Promise.all([
    listar(cambios),
    claseService.listar({ inicio }),
  ]);

  const idsAutosOcupados = new Set(
    clasesEnHorario.map((clase) => clase.auto.toString())
  );

  return flotaAutos.filter(
    (auto) => !idsAutosOcupados.has(auto._id.toString())
  );
}


export async function adjuntarAutosATurnos(turnos = [], cambios) {
  const turnosConAutos = [];

  for (const turno of turnos) {
    const autos = await obtenerAutosLibresEnTurno(turno.inicio, cambios);

    turnosConAutos.push({
      inicio: turno.inicio,
      fin: turno.fin,
      autos,
    });
  }

  return turnosConAutos;
}
