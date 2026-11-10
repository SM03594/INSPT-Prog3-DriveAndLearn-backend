import { Router } from 'express';
import { autenticar, verificarSiAdmin } from '../middlewares/authMiddleware.js';
import { validarObjetoJson } from '../middlewares/validarObjetoJson.js';
import * as administradorController from '../controllers/administradorController.js';

const router = Router();

router.get('/', autenticar, verificarSiAdmin, administradorController.listar);
router.get('/:id', autenticar, verificarSiAdmin, administradorController.obtener);

router.post('/', autenticar, verificarSiAdmin, validarObjetoJson, administradorController.crear);
router.put('/:id', autenticar, verificarSiAdmin, validarObjetoJson, administradorController.actualizar);

export default router;

