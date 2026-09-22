// ============================================================
//  alumno.routes.ts — Rutas del recurso Alumnos
// ============================================================
// Puro mapa verbo+path -> handler del controller. Se monta en
// app.ts con app.use('/api/alumnos', alumnosRoutes).

import { Router } from 'express';
import * as alumnoController from '../controllers/alumno.controller.js';

const router = Router();

router.get('/', alumnoController.listar);
router.get('/:id', alumnoController.obtener);
router.post('/', alumnoController.crear);
router.put('/:id', alumnoController.actualizar);
router.patch('/:id/sumar-clases', alumnoController.sumarClases);
router.patch('/:id/restar-clases', alumnoController.restarClases);

export default router;
