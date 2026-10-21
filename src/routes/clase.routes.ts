// ============================================================
//  clase.routes.ts — Rutas del recurso Clases
// ============================================================
// Puro mapa verbo+path -> handler del controller. Se monta en
// app.ts con app.use('/api/clases', clasesRoutes).

import { Router } from 'express';
import * as claseController from '../controllers/clase.controller.js';
import { requireAuthentication } from '../middlewares/auth.middleware.js';
import { validacionDeCuerpo } from '../middlewares/validacionDeCuerpo.middleware.js';

const router = Router();

router.use(requireAuthentication);

router.get('/', claseController.listar);
router.get('/:id', claseController.obtener);
router.post('/', validacionDeCuerpo, claseController.crear);
router.put('/:id', validacionDeCuerpo, claseController.actualizar);
router.patch('/:id/cancelar', claseController.cancelar);

export default router;
