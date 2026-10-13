// ============================================================
//  clase.controller.ts — Controller HTTP de Clases
// ============================================================
// Sin try/catch: en Express 5, si un handler async lanza o su
// promesa rechaza, el error se reenvía solo al middleware de
// errores centralizado (src/middlewares/errorHandler.middleware.ts),
// montado al final de app.ts.

import type { Request, Response } from 'express';
import * as claseService from '../services/clase.service.js';
import { ErrorDeNegocio } from '../errors/errorDeNegocio.js';
import type { ActorClase, DatosClase } from '../services/clase.service.js';

function actorDe(req: Request): ActorClase {
  if (req.auth === undefined) {
    throw new ErrorDeNegocio('Se requiere autenticación válida', 401);
  }
  return req.auth;
}

function bodyComoObjeto(req: Request): Record<string, unknown> {
  const body: unknown = req.body;
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ErrorDeNegocio('El cuerpo de la petición debe ser un objeto JSON');
  }
  return body as Record<string, unknown>;
}

function rechazarCampos(body: Record<string, unknown>, permitidos: string[]): void {
  const noPermitidos = Object.keys(body).filter((campo) => !permitidos.includes(campo));
  if (noPermitidos.length > 0) {
    throw new ErrorDeNegocio(`Campos no permitidos: ${noPermitidos.join(', ')}`);
  }
}

function stringObligatorio(body: Record<string, unknown>, campo: string): string {
  const valor = body[campo];
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw new ErrorDeNegocio(`${campo} es obligatorio`);
  }
  return valor;
}

export async function listar(req: Request, res: Response) {
  const clases = await claseService.listar(actorDe(req));
  res.json(clases);
}

export async function obtener(req: Request<{ id: string }>, res: Response) {
  const clase = await claseService.obtenerPorId(req.params.id, actorDe(req));
  if (clase === null) {
    return res.status(404).json({ mensaje: 'Clase no encontrada' });
  }

  res.json(clase);
}

export async function crear(req: Request, res: Response) {
  const actor = actorDe(req);
  const body = bodyComoObjeto(req);
  const permitidos = actor.role === 'administrador'
    ? ['alumno', 'profesor', 'auto', 'inicio', 'fin']
    : ['profesor', 'auto', 'inicio', 'fin'];
  rechazarCampos(body, permitidos);

  const datos: DatosClase = {
    ...(actor.role === 'administrador'
      ? { alumno: stringObligatorio(body, 'alumno') }
      : {}),
    profesor: stringObligatorio(body, 'profesor'),
    auto: stringObligatorio(body, 'auto'),
    inicio: stringObligatorio(body, 'inicio'),
    fin: stringObligatorio(body, 'fin'),
  };
  const clase = await claseService.crear(datos, actor);
  res.status(201).json(clase);
}

export async function actualizar(req: Request<{ id: string }>, res: Response) {
  const body = bodyComoObjeto(req);
  rechazarCampos(body, ['profesor', 'auto', 'inicio', 'fin']);
  if (Object.keys(body).length === 0) {
    throw new ErrorDeNegocio('Debe indicarse al menos un campo para actualizar');
  }
  if (body.profesor !== undefined && typeof body.profesor !== 'string') {
    throw new ErrorDeNegocio('profesor debe ser un identificador válido');
  }
  if (body.auto !== undefined && typeof body.auto !== 'string') {
    throw new ErrorDeNegocio('auto debe ser un identificador válido');
  }
  if (body.inicio !== undefined && typeof body.inicio !== 'string') {
    throw new ErrorDeNegocio('inicio debe ser una fecha ISO 8601');
  }
  if (body.fin !== undefined && typeof body.fin !== 'string') {
    throw new ErrorDeNegocio('fin debe ser una fecha ISO 8601');
  }
  const cambios: Partial<DatosClase> = {
    ...(typeof body.profesor === 'string' ? { profesor: body.profesor } : {}),
    ...(typeof body.auto === 'string' ? { auto: body.auto } : {}),
    ...(typeof body.inicio === 'string' ? { inicio: body.inicio } : {}),
    ...(typeof body.fin === 'string' ? { fin: body.fin } : {}),
  };
  const clase = await claseService.actualizar(
    req.params.id,
    cambios,
    actorDe(req),
  );
  if (clase === null) {
    return res.status(404).json({ mensaje: 'Clase no encontrada' });
  }

  res.json(clase);
}

export async function cancelar(req: Request<{ id: string }>, res: Response) {
  const clase = await claseService.cancelar(req.params.id, actorDe(req));
  if (clase === null) {
    return res.status(404).json({ mensaje: 'Clase no encontrada' });
  }

  res.json(clase);
}
