// ============================================================
//  alumno.controller.ts — Controller HTTP de Alumnos
// ============================================================
// Sin try/catch: en Express 5, si un handler async lanza o su
// promesa rechaza, el error se reenvía solo al middleware de
// errores centralizado (src/middlewares/errorHandler.middleware.ts),
// montado al final de app.ts.

import type { Request, Response } from 'express';
import * as alumnoService from '../services/alumno.service.js';
import { cuerpoComoObjeto } from '../utils/cuerpoPeticion.js';

export async function listar(_req: Request, res: Response) {
  const alumnos = await alumnoService.listar();
  res.json(alumnos);
}

export async function obtener(req: Request<{ id: string }>, res: Response) {
  const alumno = await alumnoService.obtenerPorId(req.params.id);
  if (alumno === null) {
    return res.status(404).json({ mensaje: 'Alumno no encontrado' });
  }

  res.json(alumno);
}

export async function crear(req: Request, res: Response) {
  const datos = cuerpoComoObjeto(req.body);

  const camposPermitidos = ['email', 'password', 'nomApe'];
  const camposNoPermitidos = Object.keys(datos).filter(
    (campo) => !camposPermitidos.includes(campo),
  );
  if (camposNoPermitidos.length > 0) {
    return res.status(400).json({
      mensaje: `No se pueden enviar estos campos al registrarse: ${camposNoPermitidos.join(', ')}`,
    });
  }

  if (
    typeof datos.email !== 'string' ||
    typeof datos.password !== 'string' ||
    typeof datos.nomApe !== 'string'
  ) {
    return res.status(400).json({
      mensaje: 'Email, contraseña y nombre y apellido son obligatorios',
    });
  }

  const alumno = await alumnoService.crear({
    email: datos.email,
    password: datos.password,
    nomApe: datos.nomApe,
    clasesPorReservar: 0,
  });
  res.status(201).json(alumno);
}

// cuerpoComoObjeto: 400 si el body no es un objeto JSON. Qué campos
// se pueden modificar y de qué tipo lo valida el service.
export async function actualizar(req: Request<{ id: string }>, res: Response) {
  const alumno = await alumnoService.actualizar(
    req.params.id,
    cuerpoComoObjeto(req.body),
  );
  if (alumno === null) {
    return res.status(404).json({ mensaje: 'Alumno no encontrado' });
  }

  res.json(alumno);
}

export async function eliminar(req: Request<{ id: string }>, res: Response) {
  const alumno = await alumnoService.eliminar(req.params.id);
  if (alumno === null) {
    return res.status(404).json({ mensaje: 'Alumno no encontrado' });
  }

  res.status(204).end();
}

// cuerpoComoObjeto: si el pedido no trae un objeto JSON (sin body,
// un array...), 400 acá. "cantidad" se pasa tal cual vino, sin
// convertirla: qué valores se aceptan lo decide el service.
export async function sumarClases(req: Request<{ id: string }>, res: Response) {
  const alumno = await alumnoService.sumarClasesPorReservar(
    req.params.id,
    cuerpoComoObjeto(req.body).cantidad,
  );

  if (alumno === null) {
    return res.status(404).json({ mensaje: 'Alumno no encontrado' });
  }

  res.json(alumno);
}

export async function restarClases(req: Request<{ id: string }>, res: Response) {
  const alumno = await alumnoService.restarClasesPorReservar(
    req.params.id,
    cuerpoComoObjeto(req.body).cantidad,
  );

  if (alumno === null) {
    return res.status(404).json({ mensaje: 'Alumno no encontrado' });
  }

  res.json(alumno);
}
