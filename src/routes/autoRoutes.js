import { Router } from 'express';
import { validarObjetoJson } from '../middlewares/validarObjetoJson.js';
import * as autoController from '../controllers/autoController.js';

const router = Router();

// Permite recibir opcionalmente el query parameter ?cambios=MANUAL o ?cambios=AUTOMATICO
router.get('/', autoController.listar);
router.get('/:id', autoController.obtener);

router.post('/', validarObjetoJson, autoController.crear);
router.put('/:id', validarObjetoJson, autoController.actualizar);

export default router;
