// ============================================================
//  administrador.routes.ts — Rutas del recurso Administradores
// ============================================================
// Puro mapa verbo+path -> handler del controller. Se monta en
// app.ts con app.use('/api/administradores', administradoresRoutes).

import { Router } from 'express';
import * as administradorController from '../controllers/administrador.controller.js';

const router = Router();

router.get('/', administradorController.listar);
router.get('/:id', administradorController.obtener);
router.post('/', administradorController.crear);
router.put('/:id', administradorController.actualizar);

export default router;
