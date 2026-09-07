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
