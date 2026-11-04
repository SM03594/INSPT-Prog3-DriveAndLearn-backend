// ============================================================
//  app.js — Configuración de la app Express (sin escuchar)
// ============================================================
// Separado de server.js a propósito: acá solo se arma la app
// (middlewares globales + routers). server.js es quien conecta
// la base y hace app.listen(). Esto permite, más adelante, testear
// la app con supertest sin levantar un puerto real.

import express from 'express';
import cors from 'cors';
import administradorRoutes from './routes/administradorRoutes.js';
import alumnoRoutes from './routes/alumnoRoutes.js';
import authRoutes from './routes/authRoutes.js';
import autoRoutes from './routes/autoRoutes.js';
import profesorRoutes from './routes/profesorRoutes.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/administradores', administradorRoutes);
app.use('/api/alumnos', alumnoRoutes);
app.use('/api/autos', autoRoutes);
app.use('/api/profesores', profesorRoutes);
/*
app.use('/api/clases', claseRoutes);
*/

// Ninguna ruta anterior matcheó.
app.use((_req, res) => {
  res.status(404).json({ mensaje: 'Ruta no encontrada' });
});

app.use(errorHandler);

export default app;
