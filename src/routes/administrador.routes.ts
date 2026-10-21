// ============================================================
//  administrador.routes.ts — Rutas del recurso Administradores
// ============================================================
// Puro mapa verbo+path -> handler del controller. Se monta en
// app.ts con app.use('/api/administradores', administradoresRoutes).

import { Router } from 'express';
import * as administradorController from '../controllers/administrador.controller.js';
import {
  requireAuthentication,
  requireAdministrator,
  requireSelfOrAdministrator,
} from '../middlewares/auth.middleware.js';
import { validacionDeCuerpo } from '../middlewares/validacionDeCuerpo.middleware.js';

const router = Router();

router.use(requireAuthentication);

router.get('/', requireAdministrator, administradorController.listar);
router.get(
  '/:id',
  requireSelfOrAdministrator(),
  administradorController.obtener,
);
router.post('/', requireAdministrator, validacionDeCuerpo, administradorController.crear);
router.put(
  '/:id',
  requireSelfOrAdministrator(['email', 'password', 'nomApe']),
  validacionDeCuerpo,
  administradorController.actualizar,
);
router.delete(
  '/:id',
  requireSelfOrAdministrator(),
  administradorController.eliminar,
);

export default router;
