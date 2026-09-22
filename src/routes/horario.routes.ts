// ============================================================
//  horario.routes.ts — Rutas del recurso Horario
// ============================================================
// Puro mapa verbo+path -> handler del controller. Se monta en
// app.ts con app.use('/api/horario', horarioRoutes).

import { Router } from 'express';
import * as horarioController from '../controllers/horario.controller.js';

const router = Router();

router.get('/validar/:dia', horarioController.validar);
router.post('/agregar', horarioController.agregar);
router.post('/quitar', horarioController.quitar);

export default router;
