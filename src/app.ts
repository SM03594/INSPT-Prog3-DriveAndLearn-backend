// ============================================================
//  app.ts — Configuración de la app Express (sin escuchar)
// ============================================================
// Separado de server.ts a propósito: acá solo se arma la app
// (middlewares globales + routers). server.ts es quien conecta
// la base y hace app.listen(). Esto permite, más adelante, testear
// la app con supertest sin levantar un puerto real.

import express from 'express';
import cors from 'cors';
import autosRoutes from './routes/auto.routes.js';
import { errorHandler } from './middlewares/errorHandler.middleware.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/autos', autosRoutes);

// Ninguna ruta anterior matcheó.
app.use((_req, res) => {
  res.status(404).json({ mensaje: 'Ruta no encontrada' });
});

app.use(errorHandler);

export default app;
