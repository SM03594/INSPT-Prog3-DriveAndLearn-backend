// ============================================================
//  auto.routes.ts — Rutas del recurso Autos
// ============================================================
// Puro mapa verbo+path -> handler del controller. Se monta en
// app.ts con app.use('/api/autos', autosRoutes).

import { Router } from 'express';
import * as autoController from '../controllers/auto.controller.js';

const router = Router();

router.get('/', autoController.listar);
router.get('/:id', autoController.obtener);
router.post('/', autoController.crear);
router.put('/:id', autoController.actualizar);
//router.patch('/:id/activo', autoController.cambiarActivo);

export default router;
