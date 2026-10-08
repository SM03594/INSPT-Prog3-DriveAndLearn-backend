// ============================================================
//  calendarioSemanal.routes.ts — Rutas del recurso CalendarioSemanal
// ============================================================
// Puro mapa verbo+path -> handler del controller. Se monta en
// app.ts con app.use('/api/calendario-semanal', calendarioSemanalRoutes).

import { Router } from 'express';
import * as calendarioSemanalController from '../controllers/calendarioSemanal.controller.js';
import { requireAuthentication } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAuthentication);

router.get('/validar/:dia', calendarioSemanalController.validar);
router.post('/agregar', calendarioSemanalController.agregar);
router.post('/quitar', calendarioSemanalController.quitar);

export default router;
