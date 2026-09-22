// ============================================================
//  clase.routes.ts — Rutas del recurso Clases
// ============================================================
// Puro mapa verbo+path -> handler del controller. Se monta en
// app.ts con app.use('/api/clases', clasesRoutes).

import { Router } from 'express';
import * as claseController from '../controllers/clase.controller.js';

const router = Router();

router.get('/', claseController.listar);
router.get('/:id', claseController.obtener);
router.post('/', claseController.crear);
router.put('/:id', claseController.actualizar);
router.patch('/:id/cancelar', claseController.cancelar);

export default router;
