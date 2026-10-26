import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { requireAuthentication } from '../middlewares/auth.middleware.js';
import { validacionDeCuerpo } from '../middlewares/validacionDeCuerpo.middleware.js';

const router = Router();

router.post('/login', validacionDeCuerpo, authController.login);
router.post('/logout', requireAuthentication, authController.logout);

export default router;
