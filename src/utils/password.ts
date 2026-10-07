// ============================================================
//  password.ts — Validación y hasheo de contraseñas
// ============================================================

import bcrypt from 'bcrypt';
import { ErrorDeNegocio } from '../errors/errorDeNegocio.js';

// Cantidad de rondas de sal que usa bcrypt para hashear.
const BCRYPT_ROUNDS = 10;

// Cantidad mínima de caracteres que puede tener la contraseña.
const PASSWORD_MIN_CHARS = 8;


type DatosConPasswordOpcional = { password?: unknown };


function validarPassword(password: string): void {
  if (password.length < PASSWORD_MIN_CHARS) {
    throw new ErrorDeNegocio(
      `La contraseña debe tener al menos ${PASSWORD_MIN_CHARS} caracteres`,
    );
  }
}


export async function conPasswordHasheada<Datos extends DatosConPasswordOpcional>(
  datos: Datos,
): Promise<Datos> {
  const passwordEnTextoPlano = datos.password;

  if (passwordEnTextoPlano === undefined) {
    return datos;
  }

  if (typeof passwordEnTextoPlano !== 'string') {
    throw new ErrorDeNegocio('La contraseña debe ser un texto');
  }

  validarPassword(passwordEnTextoPlano);

  const passwordHasheada = await bcrypt.hash(passwordEnTextoPlano, BCRYPT_ROUNDS);

  
  const datosConPasswordHasheada = {
    ...datos,
    password: passwordHasheada,
  };

  return datosConPasswordHasheada;
}
