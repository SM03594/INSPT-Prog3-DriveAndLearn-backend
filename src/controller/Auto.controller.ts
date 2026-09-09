import type { Request, Response } from 'express';

import {
  cambiarEstado,
  crear,
  listar,
  obtenerPorId,
  actualizar,
  type DatosAuto,
} from '../services/auto.service.js';

const CAMBIOS_VALIDOS = new Set(['automatico', 'manual']);

function normalizarCambios(cambios: unknown): string | null {
  if (typeof cambios !== 'string') {
    return null;
  }

  const cambiosNormalizados = cambios.trim().toLowerCase();

  if (!CAMBIOS_VALIDOS.has(cambiosNormalizados)) {
    return null;
  }

  return cambiosNormalizados;
}

function obtenerDatosValidos(body: Record<string, unknown>): {
  datos: Partial<DatosAuto>;
  error?: { status: number; message: string };
} {
  const datos: Partial<DatosAuto> = {};

  if ('marca' in body) {
    datos.marca = typeof body.marca === 'string' ? body.marca.trim() : body.marca as never;
  }

  if ('modelo' in body) {
    datos.modelo = typeof body.modelo === 'string' ? body.modelo.trim() : body.modelo as never;
  }

  if ('patente' in body) {
    if (typeof body.patente !== 'string' || body.patente.trim() === '') {
      return {
        datos,
        error: { status: 400, message: 'La patente es obligatoria.' },
      };
    }

    datos.patente = body.patente.trim().toUpperCase();
  }

  if ('cambios' in body) {
    const cambiosNormalizados = normalizarCambios(body.cambios);

    if (!cambiosNormalizados) {
      return {
        datos,
        error: {
          status: 400,
          message: 'Los cambios deben ser "automatico" o "manual".',
        },
      };
    }

    datos.cambios = cambiosNormalizados;
  }

  if ('activo' in body) {
    if (typeof body.activo !== 'boolean') {
      return {
        datos,
        error: { status: 400, message: 'El campo activo debe ser booleano.' },
      };
    }

    datos.activo = body.activo;
  }

  return { datos };
}

export async function listarAutos(_req: Request, res: Response) {
  try {
    const autos = await listar();
    return res.status(200).json(autos);
  } catch (error) {
    return res.status(500).json({
      message: 'No se pudieron obtener los autos.',
      error,
    });
  }
}

export async function obtenerAuto(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const auto = await obtenerPorId(id);

    if (!auto) {
      return res.status(404).json({ message: 'Auto no encontrado.' });
    }

    return res.status(200).json(auto);
  } catch (error) {
    return res.status(500).json({
      message: 'No se pudo obtener el auto.',
      error,
    });
  }
}

export async function crearAuto(req: Request, res: Response) {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    if (!body || Object.keys(body).length === 0) {
      return res.status(400).json({ message: 'Debe enviar datos para crear el auto.' });
    }

    const { datos, error } = obtenerDatosValidos(body);

    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    if (!datos.patente || !datos.cambios) {
      return res.status(400).json({
        message: 'Faltan campos obligatorios: patente y cambios.',
      });
    }

    const autoCreado = await crear({
      marca: datos.marca ?? '',
      modelo: datos.modelo ?? '',
      patente: datos.patente,
      cambios: datos.cambios,
      activo: datos.activo ?? true,
    });

    return res.status(201).json(autoCreado);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      return res.status(409).json({
        message: 'Ya existe un auto con esa patente.',
      });
    }

    return res.status(500).json({
      message: 'No se pudo crear el auto.',
      error,
    });
  }
}

export async function actualizarAuto(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const body = (req.body ?? {}) as Record<string, unknown>;

    if (!body || Object.keys(body).length === 0) {
      return res.status(400).json({ message: 'Debe enviar datos para actualizar.' });
    }

    const { datos, error } = obtenerDatosValidos(body);

    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const autoActualizado = await actualizar(id, datos);

    if (!autoActualizado) {
      return res.status(404).json({ message: 'Auto no encontrado.' });
    }

    return res.status(200).json(autoActualizado);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      return res.status(409).json({
        message: 'Ya existe un auto con esa patente.',
      });
    }

    return res.status(500).json({
      message: 'No se pudo actualizar el auto.',
      error,
    });
  }
}

export async function cambiarEstadoAuto(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { activo } = req.body ?? {};

    if (typeof activo !== 'boolean') {
      return res.status(400).json({ message: 'El campo activo debe ser booleano.' });
    }

    const autoActualizado = await cambiarEstado(id, activo);

    if (!autoActualizado) {
      return res.status(404).json({ message: 'Auto no encontrado.' });
    }

    return res.status(200).json(autoActualizado);
  } catch (error) {
    return res.status(500).json({
      message: 'No se pudo cambiar el estado del auto.',
      error,
    });
  }
}
