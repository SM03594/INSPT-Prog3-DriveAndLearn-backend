import type { Request, Response } from 'express';
import * as authService from '../services/auth.service.js';
import { aLoginDto } from '../dtos/auth.dto.js';

// aLoginDto: 400 si falta el email o la contraseña, o si no son texto.
export async function login(req: Request, res: Response) {
  const resultado = await authService.autenticar(aLoginDto(req.body));

  res.status(200).json(resultado);
}
