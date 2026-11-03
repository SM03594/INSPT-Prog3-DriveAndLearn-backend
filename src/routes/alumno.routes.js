import { Router } from 'express';
import { validarObjetoJson } from '../middlewares/validarObjetoJson.js';
import * as alumnoController from '../controllers/alumnoController.js';

const router = Router();

// Endpoints de lectura
router.get('/', alumnoController.listar);
router.get('/:id', alumnoController.obtener);

// Endpoints de escritura
router.post('/', validarObjetoJson, alumnoController.crear);
router.put('/:id', validarObjetoJson, alumnoController.actualizar);

export default router;

