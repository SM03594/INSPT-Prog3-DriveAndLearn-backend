// ============================================================
//  env.js — Configuración central de variables de entorno
// ============================================================


import 'dotenv/config';


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


export const OFFSET_HORA_UTC = Number(process.env.OFFSET_HORA_UTC || -3);


if (Number.isNaN(OFFSET_HORA_UTC)) {
  throw new Error('OFFSET_HORA_UTC debe ser un número de horas (por ejemplo, -3)');
}
