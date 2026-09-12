// ============================================================
//  app.ts — Configuración de la app Express (sin escuchar)
// ============================================================
// Separado de server.ts a propósito: acá solo se arma la app
// (middlewares globales + routers). server.ts es quien conecta
// la base y hace app.listen(). Esto permite, más adelante, testear
// la app con supertest sin levantar un puerto real.
//
// Todavía NO hay middleware de errores (4 parámetros) que traduzca
// ValidationError/CastError/11000 a 400/400/409: por ahora, un error
// en un handler async cae en el manejador de errores por defecto de
// Express (respuesta 500 genérica). Queda para una próxima etapa.

import express from 'express';
import cors from 'cors';
import autosRoutes from './routes/auto.routes.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/autos', autosRoutes);

// Ninguna ruta anterior matcheó.
app.use((_req, res) => {
  res.status(404).json({ mensaje: 'Ruta no encontrada' });
});

export default app;
