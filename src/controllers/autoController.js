import * as autoService from '../services/autoService.js';
import {
  validarCrearAutoDTO,
  validarActualizarAutoDTO,
} from '../dtos/autoDTO.js';

export async function listar(req, res) {
  const { cambios } = req.query;
  const listaAutos = await autoService.listar(cambios);

  res.status(200).json(listaAutos);
}


export async function obtener(req, res) {
  const { id } = req.params;
  const autoEncontrado = await autoService.obtenerPorId(id);

  if (!autoEncontrado) {
    return res.status(404).json({ mensaje: 'Auto no encontrado' });
  }

  res.status(200).json(autoEncontrado);
}


export async function crear(req, res) {
  validarCrearAutoDTO(req.body);

  const autoCreado = await autoService.crear(req.body);

  res.status(201).json(autoCreado);
}


export async function actualizar(req, res) {
  const { id } = req.params;

  validarActualizarAutoDTO(req.body);

  const autoActualizado = await autoService.actualizar(id, req.body);

  if (!autoActualizado) {
    return res.status(404).json({ mensaje: 'Auto no encontrado' });
  }

  res.status(200).json(autoActualizado);
}
