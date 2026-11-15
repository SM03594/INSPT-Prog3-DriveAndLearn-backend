import { Router } from 'express';
import {
  autenticar,
  verificarSiAdmin,
  verificarSiAdminOPropioUsuario,
} from '../middlewares/authMiddleware.js';
import { validarObjetoJson } from '../middlewares/validarObjetoJson.js';
import * as alumnoController from '../controllers/alumnoController.js';

const router = Router();

// Endpoints de lectura
router.get(
  '/', 
  autenticar, 
  verificarSiAdmin, 
  alumnoController.listar
);

router.get(
  '/:id', 
  autenticar, 
  verificarSiAdminOPropioUsuario, 
  alumnoController.obtener
);


// Endpoints de escritura
router.post('/', validarObjetoJson, alumnoController.crear);

router.put(
  '/:id',
  autenticar,
  verificarSiAdminOPropioUsuario,
  validarObjetoJson,
  alumnoController.actualizar
);


// Body esperado: { "cantidad": 5 }
router.patch(
  '/:id/saldo/sumar',
  autenticar,
  verificarSiAdmin,
  validarObjetoJson,
  alumnoController.sumarSaldoClases
);

router.patch(
  '/:id/saldo/restar',
  autenticar,
  verificarSiAdmin,
  validarObjetoJson,
  alumnoController.restarSaldoClases
);

export default router;
