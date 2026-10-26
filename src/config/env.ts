// ============================================================
//  env.ts — Configuración central de variables de entorno
// ============================================================
// En vez de escribir "process.env.LO_QUE_SEA" desperdigado por
// todo el código, lo leemos UNA sola vez acá y exportamos
// constantes ya tipadas. Ventajas:
//   - Un único lugar donde ver qué variables necesita la app.
//   - Valores por defecto centralizados.
//   - Si falta algo crítico, fallamos rápido y con un mensaje claro.
// ============================================================

// dotenv lee el archivo ".env" de la raíz del proyecto y vuelca
// cada línea (CLAVE=valor) dentro de process.env. Hay que
// invocarlo UNA vez, lo antes posible, antes de leer process.env.
import 'dotenv/config';

// --- PORT ---
// Puerto TCP donde el servidor HTTP va a escuchar.
// process.env.PORT siempre es string (o undefined), por eso lo
// convertimos a número. Si no está definido, usamos 3000.
export const PORT: number = Number(process.env.PORT) || 3000;

// --- MONGODB_URI ---
// Cadena de conexión a MongoDB, del estilo:
//   mongodb://localhost:27017/driveandlearn
//   mongodb+srv://usuario:pass@cluster.mongodb.net/driveandlearn
// No le ponemos default: si no está, la app no puede funcionar,
// así que preferimos que reviente al arrancar con un error
// entendible antes que fallar más adelante de forma confusa.
export const MONGODB_URI: string = process.env.MONGODB_URI ?? '';

// --- NODE_ENV ---
// 'development' | 'test' | 'production'. Nos sirve, por ejemplo,
// para NO conectar a la base real cuando corremos los tests
// (los tests levantan su propio Mongo en memoria).
export const NODE_ENV: string = process.env.NODE_ENV ?? 'development';

export function obtenerJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (secret === undefined || secret.length < 32) {
    throw new Error('JWT_SECRET debe estar configurado con al menos 32 caracteres');
  }

  return secret;
}

// --- ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NOMAPE ---
// Datos del primer administrador. Solo los usa el script
// src/scripts/bootstrapAdminDesdeEnv.ts, no el servidor: por eso es
// una función (como obtenerJwtSecret) y no una constante, así la app
// arranca igual aunque no estén definidas.
export interface DatosAdminInicial {
  email: string;
  password: string;
  nomApe: string;
}

export function obtenerAdminInicial(): DatosAdminInicial {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? '';
  const password = process.env.ADMIN_PASSWORD ?? '';
  const nomApe = process.env.ADMIN_NOMAPE?.trim() || 'Administrador';

  if (email === '' || password === '') {
    throw new Error('ADMIN_EMAIL y ADMIN_PASSWORD deben estar configurados en el .env');
  }

  return { email, password, nomApe };
}

// --- OFFSET_HORA_UTC ---
// Horas de diferencia de la escuela con UTC (Argentina: -3). Es la
// ÚNICA fuente de la hora de la escuela: los cálculos "locales" de
// utils/fechas.ts (qué día de la semana es, qué hora marca el reloj,
// qué día es hoy) la usan en vez de la zona del sistema operativo
// donde corre el server (un deploy suele correr en UTC).
// Si no está en el .env, o está sin valor, -3. Va "||" y no "??"
// porque dotenv carga "OFFSET_HORA_UTC=" como "", y "??" lo dejaría
// pasar (Number('') es 0, UTC). El "||" mira el texto, antes de
// convertirlo: "0" no es vacío, así que UTC se puede configurar igual.
// Un offset fijo no contempla el horario de verano: si el país lo
// adopta, hay que cambiar OFFSET_HORA_UTC y reiniciar el servidor.
export const OFFSET_HORA_UTC: number = Number(process.env.OFFSET_HORA_UTC || -3);

// Un valor mal escrito ("abc") daría NaN y todas las fechas saldrían
// inválidas: mejor frenar el arranque (como con JWT_SECRET).
if (Number.isNaN(OFFSET_HORA_UTC)) {
  throw new Error('OFFSET_HORA_UTC debe ser un número de horas (por ejemplo, -3)');
}
