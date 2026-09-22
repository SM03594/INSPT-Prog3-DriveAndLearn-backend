// ============================================================
//  profesor.routes.ts — Rutas del recurso Profesores
// ============================================================
// Puro mapa verbo+path -> handler del controller. Se monta en
// app.ts con app.use('/api/profesores', profesoresRoutes).

import { Router } from 'express';
import * as profesorController from '../controllers/profesor.controller.js';

const router = Router();

router.get('/', profesorController.listar);
router.get('/:id', profesorController.obtener);
router.patch('/:id/nom-ape', profesorController.cambiarNomApe);
router.patch('/:id/foto-perfil', profesorController.cambiarFotoPerfil);
router.post('/:id/disponibilidad', profesorController.agregarDisponibilidad);
router.delete('/:id/disponibilidad', profesorController.quitarDisponibilidad);

export default router;
