import type { Request, Response } from 'express';

import {
  crear,
  listar,
  obtenerPorId,
  actualizar,
  restarClasesPorReservar,
  sumarClasesPorReservar,
  type Alumno,
} from '../services/alumno.service.js';

function obtenerDatosValidos(body: Record<string, unknown>): {
  datos: Partial<Alumno>;
  error?: { status: number; message: string };
} {
  const datos: Partial<Alumno> = {};

  if ('email' in body) {
    if (typeof body.email !== 'string' || body.email.trim() === '') {
      return {
        datos,
        error: { status: 400, message: 'El email es obligatorio.' },
      };
    }

    datos.email = body.email.trim().toLowerCase();
  }

  if ('password' in body) {
    if (typeof body.password !== 'string' || body.password.trim() === '') {
      return {
        datos,
        error: { status: 400, message: 'La contraseña es obligatoria.' },
      };
    }

    datos.password = body.password;
  }

  if ('nomApe' in body) {
    if (typeof body.nomApe !== 'string' || body.nomApe.trim() === '') {
      return {
        datos,
        error: { status: 400, message: 'El nombre y apellido es obligatorio.' },
      };
    }

    datos.nomApe = body.nomApe.trim();
  }

  if ('clasesPorReservar' in body) {
    if (
      typeof body.clasesPorReservar !== 'number' ||
      !Number.isInteger(body.clasesPorReservar) ||
      body.clasesPorReservar < 0
    ) {
      return {
        datos,
        error: {
          status: 400,
          message: 'clasesPorReservar debe ser un número entero mayor o igual a 0.',
        },
      };
    }

    datos.clasesPorReservar = body.clasesPorReservar;
  }

  return { datos };
}

export async function listarAlumnos(_req: Request, res: Response) {
  try {
    const alumnos = await listar();
    return res.status(200).json(alumnos);
  } catch (error) {
    return res.status(500).json({
      message: 'No se pudieron obtener los alumnos.',
      error,
    });
  }
}

export async function obtenerAlumno(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const alumno = await obtenerPorId(id);

    if (!alumno) {
      return res.status(404).json({ message: 'Alumno no encontrado.' });
    }

    return res.status(200).json(alumno);
  } catch (error) {
    return res.status(500).json({
      message: 'No se pudo obtener el alumno.',
      error,
    });
  }
}

export async function crearAlumno(req: Request, res: Response) {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    if (!body || Object.keys(body).length === 0) {
      return res.status(400).json({ message: 'Debe enviar datos para crear el alumno.' });
    }

    const { datos, error } = obtenerDatosValidos(body);

    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    if (!datos.email || !datos.password || !datos.nomApe) {
      return res.status(400).json({
        message: 'Faltan campos obligatorios: email, password y nomApe.',
      });
    }

    const alumnoCreado = await crear({
      email: datos.email,
      password: datos.password,
      nomApe: datos.nomApe,
      clasesPorReservar: datos.clasesPorReservar ?? 0,
    });

    return res.status(201).json(alumnoCreado);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      return res.status(409).json({
        message: 'Ya existe un alumno con ese email.',
      });
    }

    return res.status(500).json({
      message: 'No se pudo crear el alumno.',
      error,
    });
  }
}

export async function actualizarAlumno(req: Request, res: Response) {
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

    const alumnoActualizado = await actualizar(id, datos);

    if (!alumnoActualizado) {
      return res.status(404).json({ message: 'Alumno no encontrado.' });
    }

    return res.status(200).json(alumnoActualizado);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      return res.status(409).json({
        message: 'Ya existe un alumno con ese email.',
      });
    }

    return res.status(500).json({
      message: 'No se pudo actualizar el alumno.',
      error,
    });
  }
}

export async function sumarClasesAlumno(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { cantidad } = req.body ?? {};

    if (typeof cantidad !== 'number' || !Number.isInteger(cantidad) || cantidad < 0) {
      return res.status(400).json({
        message: 'La cantidad debe ser un número entero mayor o igual a 0.',
      });
    }

    const alumnoActualizado = await sumarClasesPorReservar(id, cantidad);

    if (!alumnoActualizado) {
      return res.status(404).json({ message: 'Alumno no encontrado.' });
    }

    return res.status(200).json(alumnoActualizado);
  } catch (error) {
    return res.status(500).json({
      message: 'No se pudieron sumar clases para reservar.',
      error,
    });
  }
}

export async function restarClasesAlumno(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { cantidad } = req.body ?? {};

    if (typeof cantidad !== 'number' || !Number.isInteger(cantidad) || cantidad < 0) {
      return res.status(400).json({
        message: 'La cantidad debe ser un número entero mayor o igual a 0.',
      });
    }

    const alumnoActualizado = await restarClasesPorReservar(id, cantidad);

    if (!alumnoActualizado) {
      return res.status(404).json({ message: 'Alumno no encontrado.' });
    }

    return res.status(200).json(alumnoActualizado);
  } catch (error) {
    return res.status(500).json({
      message: 'No se pudieron restar clases para reservar.',
      error,
    });
  }
}
