import { Router } from 'express';
import { validarObjetoJson } from '../middlewares/validarObjetoJson.js';
import * as administradorController from '../controllers/administradorController.js';

const router = Router();

router.get('/', administradorController.listar);
router.get('/:id', administradorController.obtener);

router.post('/', validarObjetoJson, administradorController.crear);
router.put('/:id', validarObjetoJson, administradorController.actualizar);

export default router;

