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
import alumnosRoutes from './routes/alumno.routes.js';
import administradoresRoutes from './routes/administrador.routes.js';
import profesoresRoutes from './routes/profesor.routes.js';
import clasesRoutes from './routes/clase.routes.js';
import calendarioSemanalRoutes from './routes/calendarioSemanal.routes.js';
import horarioRoutes from './routes/horario.routes.js';
import { errorHandler } from './middlewares/errorHandler.middleware.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/autos', autosRoutes);
app.use('/api/alumnos', alumnosRoutes);
app.use('/api/administradores', administradoresRoutes);
app.use('/api/profesores', profesoresRoutes);
app.use('/api/clases', clasesRoutes);
app.use('/api/calendario-semanal', calendarioSemanalRoutes);
app.use('/api/horario', horarioRoutes);

// Ninguna ruta anterior matcheó.
app.use((_req, res) => {
  res.status(404).json({ mensaje: 'Ruta no encontrada' });
});

app.use(errorHandler);

export default app;
