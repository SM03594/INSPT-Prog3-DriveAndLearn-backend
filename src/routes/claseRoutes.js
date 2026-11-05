import { Router } from 'express';
import { autenticar } from '../middlewares/authMiddleware.js';
import { validarObjetoJson } from '../middlewares/validarObjetoJson.js';
import * as claseController from '../controllers/claseController.js';

const router = Router();

// Endpoints de lectura
router.get('/', [autenticar], claseController.listar);
router.get('/:id', [autenticar], claseController.obtener);

// Endpoints de escritura
router.post('/', [autenticar], validarObjetoJson, claseController.agendar);
router.delete('/:id',[autenticar], claseController.eliminar);

export default router;
