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

// --- OFFSET_UTC ---
// Diferencia de la hora de la escuela con UTC, como "±HH:MM". Es la
// ÚNICA fuente de la hora de la escuela: todo cálculo "local" (qué día
// de la semana es, qué hora marca el reloj en la escuela, qué día es
// hoy) usa esta constante, nunca la zona del sistema operativo donde
// corre el server (un deploy suele correr en UTC).
// Un offset fijo no contempla el horario de verano: si el país lo
// adopta, hay que cambiar OFFSET_UTC y reiniciar el servidor.
const OFFSET_UTC_POR_DEFECTO = '-03:00';
const FORMATO_OFFSET = /^([+-])(\d{2}):(\d{2})$/;
const HORAS_MAXIMAS_OFFSET = 14;

export interface OffsetUtc {
  texto: string; // "-03:00"
  minutos: number; // -180
}

// Un valor mal escrito frena el arranque (como JWT_SECRET): un offset
// equivocado correría todas las clases sin dar ningún error.
// Se exporta para poder testearla sin tocar process.env.
export function parsearOffsetUtc(valor: string | undefined): OffsetUtc {
  // dotenv carga "OFFSET_UTC=" (sin valor) como "": por eso el
  // default no puede ir con "??".
  const texto = valor === undefined || valor.trim() === ''
    ? OFFSET_UTC_POR_DEFECTO
    : valor.trim();
  const partes = FORMATO_OFFSET.exec(texto);
  const horas = Number(partes?.[2]);
  const minutos = Number(partes?.[3]);
  const esOffsetValido =
    partes !== null && horas <= HORAS_MAXIMAS_OFFSET && minutos <= 59;

  if (!esOffsetValido) {
    throw new Error('OFFSET_UTC debe tener el formato ±HH:MM (por ejemplo, -03:00)');
  }

  const signo = partes[1] === '-' ? -1 : 1;
  return { texto, minutos: signo * (horas * 60 + minutos) };
}

const offsetUtc = parsearOffsetUtc(process.env.OFFSET_UTC);
export const OFFSET_UTC: string = offsetUtc.texto;
export const OFFSET_UTC_MINUTOS: number = offsetUtc.minutos;
