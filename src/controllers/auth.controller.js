import * as authService from '../services/authService.js';
import { validarLoginDTO } from '../dtos/authDTO.js';

export async function login(req, res) {
  validarLoginDTO(req.body);

  const respuestaLogin = await authService.login(req.body);

  res.status(200).json(respuestaLogin);
}

