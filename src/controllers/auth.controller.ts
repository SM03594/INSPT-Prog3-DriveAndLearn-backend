import type { Request, Response } from 'express';
import * as authService from '../services/auth.service.js';

export async function login(req: Request, res: Response) {
  const resultado = await authService.autenticar(
    req.body?.email,
    req.body?.password,
  );

  res.status(200).json(resultado);
}
