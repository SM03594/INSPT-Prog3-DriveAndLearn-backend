// ============================================================
//  horarioEscuela.routes.ts — Rutas del horario de la escuela
// ============================================================
// Puro mapa verbo+path -> handler del controller. Se monta en
// app.ts con app.use('/api/horario-escuela', horarioEscuelaRoutes).

import { Router } from 'express';
import * as horarioEscuelaController from '../controllers/horarioEscuela.controller.js';
import {
  requireAuthentication,
  requireAdministrator,
} from '../middlewares/auth.middleware.js';
import { validacionDeCuerpo } from '../middlewares/validacionDeCuerpo.middleware.js';

const router = Router();

router.use(requireAuthentication);

router.get('/', horarioEscuelaController.obtener);
router.put('/', requireAdministrator, validacionDeCuerpo, horarioEscuelaController.reemplazar);
router.get('/validar/:dia', horarioEscuelaController.validar);
router.post('/agregar', requireAdministrator, validacionDeCuerpo, horarioEscuelaController.agregar);
router.post('/quitar', requireAdministrator, validacionDeCuerpo, horarioEscuelaController.quitar);

export default router;
