// ============================================================
//  auto.routes.ts — Rutas del recurso Autos
// ============================================================
// Puro mapa verbo+path -> handler del controller. Se monta en
// app.ts con app.use('/api/autos', autosRoutes).

import { Router } from 'express';
import * as autoController from '../controllers/auto.controller.js';
import {
  requireAuthentication,
  requireAdministrator,
} from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAuthentication);

router.get('/', autoController.listar);
router.get('/:id', autoController.obtener);
router.post('/', requireAdministrator, autoController.crear);
router.put('/:id', requireAdministrator, autoController.actualizar);
router.patch('/:id/activo', requireAdministrator, autoController.cambiarActivo);

export default router;
