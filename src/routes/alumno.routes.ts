// ============================================================
//  alumno.routes.ts — Rutas del recurso Alumnos
// ============================================================
// Puro mapa verbo+path -> handler del controller. Se monta en
// app.ts con app.use('/api/alumnos', alumnosRoutes).

import { Router } from 'express';
import * as alumnoController from '../controllers/alumno.controller.js';
import {
  requireAuthentication,
  requireAdministrator,
  requireSelfOrAdministrator,
} from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/', alumnoController.crear);

router.use(requireAuthentication);

router.get('/', requireAdministrator, alumnoController.listar);
router.get('/:id', requireSelfOrAdministrator(), alumnoController.obtener);
router.put(
  '/:id',
  requireSelfOrAdministrator(['email', 'password', 'nomApe']),
  alumnoController.actualizar,
);
router.delete('/:id', requireSelfOrAdministrator(), alumnoController.eliminar);
router.patch(
  '/:id/sumar-clases',
  requireAdministrator,
  alumnoController.sumarClases,
);
router.patch(
  '/:id/restar-clases',
  requireAdministrator,
  alumnoController.restarClases,
);

export default router;
