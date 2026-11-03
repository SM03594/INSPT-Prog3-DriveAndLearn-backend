import * as alumnoService from '../services/alumnoService.js';
import {
  validarCrearAlumnoDTO,
  validarActualizarAlumnoDTO,
} from '../dtos/alumnoDTO.js';

export async function listar(_req, res) {
  const listaAlumnos = await alumnoService.listar();

  res.status(200).json(listaAlumnos);
}

export async function obtener(req, res) {
  const { id } = req.params;
  const alumnoEncontrado = await alumnoService.obtenerPorId(id);

  if (!alumnoEncontrado) {
    return res.status(404).json({ mensaje: 'Alumno no encontrado' });
  }

  res.status(200).json(alumnoEncontrado);
}

export const obtenerPorId = obtener;

export async function crear(req, res) {
  validarCrearAlumnoDTO(req.body);

  const alumnoCreado = await alumnoService.crear(req.body);

  res.status(201).json(alumnoCreado);
}

export async function actualizar(req, res) {
  const { id } = req.params;

  validarActualizarAlumnoDTO(req.body);

  const alumnoActualizado = await alumnoService.actualizar(id, req.body);

  if (!alumnoActualizado) {
    return res.status(404).json({ mensaje: 'Alumno no encontrado' });
  }

  res.status(200).json(alumnoActualizado);
}
