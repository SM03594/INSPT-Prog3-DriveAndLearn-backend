import type { Request, Response } from 'express';
import {
  crear,
  listar,
  obtenerPorId,
  actualizar,
  restarClasesPorReservar,
  sumarClasesPorReservar,
} from '../services/alumno.service.js';

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
    mensaje.includes('cantidad') ||
    mensaje.includes('obligatorio') ||
    mensaje.includes('clasesporreservar') ||
    mensaje.includes('validation') ||
    mensaje.includes('required') ||
    mensaje.includes('enum')
  ) {
    return res.status(400).json({ message });
  }

  return res.status(500).json({ message });
}

export async function listarAlumnos(_req: Request, res: Response) {
  try {
    const alumnos = await listar();
    return res.status(200).json(alumnos);
  } catch (error) {
    return responderError(res, error);
  }
}

export async function obtenerAlumno(req: Request, res: Response) {
  try {
    const alumno = await obtenerPorId(obtenerId(req));

    if (alumno === null) {
      return res.status(404).json({ message: 'Alumno no encontrado' });
    }

    return res.status(200).json(alumno);
  } catch (error) {
    return responderError(res, error);
  }
}

export async function crearAlumno(req: Request, res: Response) {
  try {
    const alumno = await crear(req.body);
    return res.status(201).json(alumno);
  } catch (error) {
    return responderError(res, error);
  }
}

export async function actualizarAlumno(req: Request, res: Response) {
  try {
    const alumno = await actualizar(obtenerId(req), req.body);

    if (alumno === null) {
      return res.status(404).json({ message: 'Alumno no encontrado' });
    }

    return res.status(200).json(alumno);
  } catch (error) {
    return responderError(res, error);
  }
}

export async function sumarClasesAlumno(req: Request, res: Response) {
  try {
    const alumno = await sumarClasesPorReservar(
      obtenerId(req),
      Number(req.body.cantidad),
    );

    if (alumno === null) {
      return res.status(404).json({ message: 'Alumno no encontrado' });
    }

    return res.status(200).json(alumno);
  } catch (error) {
    return responderError(res, error);
  }
}

export async function restarClasesAlumno(req: Request, res: Response) {
  try {
    const alumno = await restarClasesPorReservar(
      obtenerId(req),
      Number(req.body.cantidad),
    );

    if (alumno === null) {
      return res.status(404).json({ message: 'Alumno no encontrado' });
    }

    return res.status(200).json(alumno);
  } catch (error) {
    return responderError(res, error);
  }
}
