import type { Request, Response } from 'express';
import {
  cambiarEstado,
  crear,
  listar,
  obtenerPorId,
  actualizar,
} from '../services/auto.service.js';

function obtenerId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

function responderError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : 'Error inesperado';
  const mensaje = message.toLowerCase();

  if (
    mensaje.includes('no encontrado') ||
    mensaje.includes('not found')
  ) {
    return res.status(404).json({ message });
  }

  if (
    mensaje.includes('ya existe') ||
    mensaje.includes('duplicate') ||
    mensaje.includes('duplicada')
  ) {
    return res.status(409).json({ message });
  }

  if (
    mensaje.includes('cast') ||
    mensaje.includes('objectid') ||
    mensaje.includes('id') ||
    mensaje.includes('obligatorio') ||
    mensaje.includes('validation') ||
    mensaje.includes('required') ||
    mensaje.includes('enum')
  ) {
    return res.status(400).json({ message });
  }

  return res.status(500).json({ message });
}

export async function listarAutos(_req: Request, res: Response) {
  try {
    const autos = await listar();
    return res.status(200).json(autos);
  } catch (error) {
    return responderError(res, error);
  }
}

export async function obtenerAuto(req: Request, res: Response) {
  try {
    const auto = await obtenerPorId(obtenerId(req));

    if (auto === null) {
      return res.status(404).json({ message: 'Auto no encontrado' });
    }

    return res.status(200).json(auto);
  } catch (error) {
    return responderError(res, error);
  }
}

export async function crearAuto(req: Request, res: Response) {
  try {
    const auto = await crear(req.body);
    return res.status(201).json(auto);
  } catch (error) {
    return responderError(res, error);
  }
}

export async function actualizarAuto(req: Request, res: Response) {
  try {
    const auto = await actualizar(obtenerId(req), req.body);

    if (auto === null) {
      return res.status(404).json({ message: 'Auto no encontrado' });
    }

    return res.status(200).json(auto);
  } catch (error) {
    return responderError(res, error);
  }
}

export async function cambiarEstadoAuto(req: Request, res: Response) {
  try {
    const auto = await cambiarEstado(obtenerId(req), Boolean(req.body.activo));

    if (auto === null) {
      return res.status(404).json({ message: 'Auto no encontrado' });
    }

    return res.status(200).json(auto);
  } catch (error) {
    return responderError(res, error);
  }
}
