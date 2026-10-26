import type { Request, Response } from 'express';
import * as authService from '../services/auth.service.js';
import type { ResultadoAutenticacion } from '../services/auth.service.js';
import { aLoginDto, type LoginDto } from '../dtos/auth.dto.js';

// aLoginDto: 400 si falta el email o la contraseña, o si no son texto.
export async function login(req: Request, res: Response) {
  const credenciales: LoginDto = aLoginDto(req.body);
  const resultado: ResultadoAutenticacion = await authService.autenticar(credenciales);

  res.status(200).json(resultado);
}
