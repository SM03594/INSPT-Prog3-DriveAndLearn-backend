import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { validacionDeCuerpo } from '../middlewares/validacionDeCuerpo.middleware.js';

const router = Router();

router.post('/login', validacionDeCuerpo, authController.login);

export default router;
