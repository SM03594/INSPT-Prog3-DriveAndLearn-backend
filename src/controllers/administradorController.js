import * as administradorService from '../services/administradorService.js';
import {
  validarCrearAdministradorDTO,
  validarActualizarAdministradorDTO,
} from '../dtos/administradorDTO.js';


export async function listar(_req, res) {
  const listaAdministradores = await administradorService.listar();

  res.status(200).json(listaAdministradores);
}


export async function obtener(req, res) {
  const { id } = req.params;
  const administradorEncontrado = await administradorService.obtenerPorId(id);

  if (!administradorEncontrado) {
    return res.status(404).json({ mensaje: 'Administrador no encontrado' });
  }

  res.status(200).json(administradorEncontrado);
}


export async function crear(req, res) {
  validarCrearAdministradorDTO(req.body);

  const administradorCreado = await administradorService.crear(req.body);

  res.status(201).json(administradorCreado);
}


export async function actualizar(req, res) {
  const { id } = req.params;

  validarActualizarAdministradorDTO(req.body);

  const administradorActualizado = await administradorService.actualizar(
    id,
    req.body
  );

  if (!administradorActualizado) {
    return res.status(404).json({ mensaje: 'Administrador no encontrado' });
  }

  res.status(200).json(administradorActualizado);
}
