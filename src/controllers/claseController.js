import * as claseService from '../services/claseService.js';
import { validarAgendarClaseDTO } from '../dtos/claseDTO.js';


export async function listar(req, res) {
  const listaClases = await claseService.listar(req.query, req.usuario);

  res.status(200).json(listaClases);
}


export async function obtener(req, res) {
  const { id } = req.params;
  const claseEncontrada = await claseService.obtenerPorId(id, req.usuario);

  if (!claseEncontrada) {
    return res.status(404).json({ mensaje: 'Clase no encontrada' });
  }

  res.status(200).json(claseEncontrada);
}


export async function agendar(req, res) {
  validarAgendarClaseDTO(req.body);

  const datosClase = {
    ...req.body,
    alumno: req.usuario?.id,
  };

  const claseCreada = await claseService.agendar(datosClase, req.usuario);

  res.status(201).json(claseCreada);
}


export async function eliminar(req, res) {
  const { id } = req.params;
  const claseEliminada = await claseService.eliminar(id, req.usuario);

  res.status(200).json(claseEliminada);
}
