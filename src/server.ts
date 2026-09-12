// ============================================================
//  server.ts — Punto de entrada: conecta la base y levanta HTTP
// ============================================================
// Primero connectDB(), recién después app.listen(): si la base no
// responde, no tiene sentido aceptar pedidos.

import app from './app.js';
import { connectDB } from './config/db.js';
import { PORT } from './config/env.js';

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor escuchando en el puerto ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('No se pudo conectar a MongoDB:', err);
    process.exit(1);
  });
