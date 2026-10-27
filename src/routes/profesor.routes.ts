// ============================================================
//  profesor.routes.ts — Rutas del recurso Profesores
// ============================================================
// Puro mapa verbo+path -> handler del controller. Se monta en
// app.ts con app.use('/api/profesores', profesoresRoutes).

import { Router } from 'express';
import * as profesorController from '../controllers/profesor.controller.js';
import {
  requireAuthentication,
  requireAdministrator,
} from '../middlewares/auth.middleware.js';
import { validacionDeCuerpo } from '../middlewares/validacionDeCuerpo.middleware.js';

const router = Router();

router.use(requireAuthentication);

router.post('/', requireAdministrator, validacionDeCuerpo, profesorController.crear);
router.get('/', profesorController.listar);
router.get('/:id', profesorController.obtener);
router.patch('/:id/nom-ape', requireAdministrator, validacionDeCuerpo, profesorController.cambiarNomApe);
router.post('/:id/disponibilidad', requireAdministrator, validacionDeCuerpo, profesorController.agregarDisponibilidad);

export default router;
