import * as profesorService from '../services/profesorService.js';
import {
  validarCrearProfesorDTO,
  validarActualizarProfesorDTO,
  validarAgregarDisponibilidadDTO,
  validarQuitarDisponibilidadDTO,
  validarTurnosLibresQueryDTO,
} from '../dtos/profesorDTO.js';


export async function listar(_req, res) {
  const listaProfesores = await profesorService.listar();

  res.status(200).json(listaProfesores);
}


export async function obtener(req, res) {
  const { id } = req.params;
  const profesorEncontrado = await profesorService.obtenerPorId(id);

  if (!profesorEncontrado) {
    return res.status(404).json({ mensaje: 'Profesor no encontrado' });
  }

  res.status(200).json(profesorEncontrado);
}


export async function crear(req, res) {
  validarCrearProfesorDTO(req.body);

  const profesorCreado = await profesorService.crear(req.body);

  res.status(201).json(profesorCreado);
}


export async function actualizar(req, res) {
  const { id } = req.params;

  validarActualizarProfesorDTO(req.body);

  const profesorActualizado = await profesorService.actualizar(id, req.body);

  if (!profesorActualizado) {
    return res.status(404).json({ mensaje: 'Profesor no encontrado' });
  }

  res.status(200).json(profesorActualizado);
}


// Si el profesor no existe, el service lanza ErrorRegistroInexistente (404)
// y el errorHandler responde, por eso no se chequea null en las funciones de disponibilidad.
export async function verDisponibilidad(req, res) {
  const { id } = req.params;
  const disponibilidadProfesor = await profesorService.verDisponibilidad(id);

  res.status(200).json(disponibilidadProfesor);
}


export async function agregarDisponibilidad(req, res) {
  const { id } = req.params;

  validarAgregarDisponibilidadDTO(req.body);

  const profesorActualizado = await profesorService.agregarDisponibilidad(
    id,
    req.body.tramos
  );

  res.status(200).json(profesorActualizado);
}


export async function quitarDisponibilidad(req, res) {
  const { id } = req.params;

  validarQuitarDisponibilidadDTO(req.body);

  const profesorActualizado = await profesorService.quitarDisponibilidad(
    id,
    req.body.tramos
  );

  res.status(200).json(profesorActualizado);
}


export async function verTurnosLibres(req, res) {
  const { id } = req.params;
  validarTurnosLibresQueryDTO(req.query);

  const { fecha, cambios } = req.query;

  const resultado = await profesorService.obtenerTurnosLibres({
    profesorId: id,
    fecha,
    cambios,
  });

  res.status(200).json(resultado);
}
