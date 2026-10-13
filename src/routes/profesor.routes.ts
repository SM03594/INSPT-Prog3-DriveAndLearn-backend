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

const router = Router();

router.use(requireAuthentication);

router.post('/', requireAdministrator, profesorController.crear);
router.get('/', profesorController.listar);
router.get('/:id', profesorController.obtener);
router.patch('/:id/nom-ape', requireAdministrator, profesorController.cambiarNomApe);
router.patch('/:id/foto-perfil', requireAdministrator, profesorController.cambiarFotoPerfil);
router.post('/:id/disponibilidad', requireAdministrator, profesorController.agregarDisponibilidad);
router.delete('/:id/disponibilidad', requireAdministrator, profesorController.quitarDisponibilidad);

export default router;
