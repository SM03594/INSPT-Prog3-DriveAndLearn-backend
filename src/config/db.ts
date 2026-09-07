// ============================================================
//  db.ts — Conexión a MongoDB con Mongoose
// ============================================================
// En el template "recetorium", este archivo empezaba siendo una
// base de datos SIMULADA en memoria (arrays de JS). Acá ya damos
// el paso a MongoDB real usando Mongoose.
//
// Mongoose es un ODM (Object Document Mapper): traduce entre los
// documentos de MongoDB y objetos de JavaScript, y encima nos da
// esquemas con validaciones. Mantiene UNA conexión global que
// comparten todos los modelos, por eso alcanza con llamar a
// connectDB() una sola vez al arrancar el servidor.
// ============================================================

import mongoose from 'mongoose';
import { MONGODB_URI } from './env.js';

/**
 * Abre la conexión con MongoDB.
 * La llamamos desde server.ts ANTES de poner a escuchar el
 * servidor HTTP: si la base no responde, no tiene sentido
 * aceptar pedidos.
 */
export async function connectDB(): Promise<void> {
  if (!MONGODB_URI) {
    // Falla temprana y explícita: mejor un error claro ahora
    // que un timeout raro en el primer request.
    throw new Error(
      'Falta la variable de entorno MONGODB_URI (revisá tu archivo .env)',
    );
  }

  // strictQuery: true => Mongoose ignora en los filtros los
  // campos que no estén declarados en el esquema. Evita queries
  // silenciosamente vacías por un typo en el nombre de un campo.
  mongoose.set('strictQuery', true);

  // mongoose.connect devuelve una promesa que resuelve cuando la
  // conexión quedó establecida. Si falla (URI mala, red caída),
  // rechaza y el error sube hasta server.ts.
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Conectado a MongoDB');
}

/**
 * Cierra la conexión de forma ordenada.
 * Útil para apagar el proceso "limpio" (Ctrl+C, tests, etc.).
 */
export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
