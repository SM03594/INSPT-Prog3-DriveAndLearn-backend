// ============================================================
//  horario.routes.ts — Rutas del recurso Horario
// ============================================================
// Puro mapa verbo+path -> handler del controller. Se monta en
// app.ts con app.use('/api/horario', horarioRoutes).

import { Router } from 'express';
import * as horarioController from '../controllers/horario.controller.js';
import {
  requireAuthentication,
  requireAdministrator,
} from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAuthentication);

router.get('/', horarioController.obtener);
router.put('/', requireAdministrator, horarioController.reemplazar);
router.get('/validar/:dia', horarioController.validar);
router.post('/agregar', requireAdministrator, horarioController.agregar);
router.post('/quitar', requireAdministrator, horarioController.quitar);

export default router;
