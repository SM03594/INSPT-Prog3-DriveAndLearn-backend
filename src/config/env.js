// ============================================================
//  env.js — Configuración central de variables de entorno
// ============================================================


import 'dotenv/config';
import { IANAZone } from 'luxon';


export const PORT = Number(process.env.PORT) || 3000;


export const MONGODB_URI = process.env.MONGODB_URI ?? '';


// --- NODE_ENV ---
// 'development' | 'test' | 'production'. Nos sirve, por ejemplo,
// para NO conectar a la base real cuando corremos los tests
// (los tests levantan su propio Mongo en memoria).
export const NODE_ENV = process.env.NODE_ENV ?? 'development';


export function obtenerJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (secret === undefined || secret.length < 32) {
    throw new Error('JWT_SECRET debe estar configurado con al menos 32 caracteres');
  }

  return secret;
}


export function obtenerAdminInicial() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? '';
  const password = process.env.ADMIN_PASSWORD ?? '';
  const nomApe = process.env.ADMIN_NOMAPE?.trim() || 'Administrador';

  if (email === '' || password === '') {
    throw new Error('ADMIN_EMAIL y ADMIN_PASSWORD deben estar configurados en el .env');
  }

  return { email, password, nomApe };
}


export const ZONA_HORARIA =
  process.env.ZONA_HORARIA?.trim() || 'America/Argentina/Buenos_Aires';


if (!IANAZone.isValidZone(ZONA_HORARIA)) {
  throw new Error(`ZONA_HORARIA no es una zona IANA válida: "${ZONA_HORARIA}"`);
}
