import { Router } from 'express';
import { validarObjetoJson } from '../middlewares/validarObjetoJson.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

router.post('/login', validarObjetoJson, authController.login);

export default router;

