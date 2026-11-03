import { Router } from 'express';
import { validarObjetoJson } from '../middlewares/validarObjetoJson.js';
import { autenticar } from '../middlewares/authMiddleware.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

router.post('/login', validarObjetoJson, authController.login);
router.post('/logout', autenticar, authController.logout);

export default router;
