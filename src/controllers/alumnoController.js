import * as alumnoService from '../services/alumnoService.js';
import {
  validarCrearAlumnoDTO,
  validarActualizarAlumnoDTO,
  validarSumarSaldoClasesDTO,
  validarRestarSaldoClasesDTO,
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


export async function sumarSaldoClases(req, res) {
  const { id } = req.params;

  validarSumarSaldoClasesDTO(req.body);

  const alumnoActualizado = await alumnoService.sumarSaldoClases(id, req.body);

  if (!alumnoActualizado) {
    return res.status(404).json({ mensaje: 'Alumno no encontrado' });
  }

  res.status(200).json(alumnoActualizado);
}


export async function restarSaldoClases(req, res) {
  const { id } = req.params;

  validarRestarSaldoClasesDTO(req.body);

  const alumnoActualizado = await alumnoService.restarSaldoClases(id, req.body);

  if (!alumnoActualizado) {
    return res.status(404).json({ mensaje: 'Alumno no encontrado' });
  }

  res.status(200).json(alumnoActualizado);
}
