import type { Request, Response } from 'express';
import * as authService from '../services/auth.service.js';
import { aLoginDto } from '../dtos/auth.dto.js';

// aLoginDto: 400 si falta el email o la contraseña, o si no son texto.
export async function login(req: Request, res: Response) {
  const resultado = await authService.autenticar(aLoginDto(req.body));

  res.status(200).json(resultado);
}

export async function logout(req: Request, res: Response) {
  const auth = req.auth!;

  await authService.revocarToken(auth.token, auth.exp);
  res.status(204).end();
}
