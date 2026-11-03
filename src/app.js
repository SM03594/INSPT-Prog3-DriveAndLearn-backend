// ============================================================
//  app.js — Configuración de la app Express (sin escuchar)
// ============================================================
// Separado de server.js a propósito: acá solo se arma la app
// (middlewares globales + routers). server.js es quien conecta
// la base y hace app.listen(). Esto permite, más adelante, testear
// la app con supertest sin levantar un puerto real.

import express from 'express';
import cors from 'cors';
import administradorRoutes from './routes/administrador.routes.js';
import alumnoRoutes from './routes/alumno.routes.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/administradores', administradorRoutes);
app.use('/api/alumnos', alumnoRoutes);
/*
app.use('/api/auth', authRoutes);
app.use('/api/autos', autosRoutes);
app.use('/api/profesores', profesoresRoutes);
app.use('/api/clases', clasesRoutes);
*/

// Ninguna ruta anterior matcheó.
app.use((_req, res) => {
  res.status(404).json({ mensaje: 'Ruta no encontrada' });
});

app.use(errorHandler);

export default app;
