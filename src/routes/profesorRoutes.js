import { Router } from 'express';
import { autenticar, verificarSiAdmin } from '../middlewares/authMiddleware.js';
import { validarObjetoJson } from '../middlewares/validarObjetoJson.js';
import * as profesorController from '../controllers/profesorController.js';

const router = Router();

// Endpoints de lectura (públicos para permitir consultar turnos y disponibilidad)
router.get('/', profesorController.listar);
router.get('/:id', profesorController.obtener);
router.get('/:id/disponibilidad', profesorController.verDisponibilidad);
router.get('/:id/turnos-libres', profesorController.verTurnosLibres);

// Endpoints de escritura (solo administrador)
router.post('/', autenticar, verificarSiAdmin, validarObjetoJson, profesorController.crear);
router.put('/:id', autenticar, verificarSiAdmin, validarObjetoJson, profesorController.actualizar);

// La disponibilidad solo se modifica por estos endpoints (no por PUT /:id).
// Body esperado: { "tramos": [{ "dia": "lunes", "tramoHorario": { "horaInicio": "08:00", "horaFin": "12:00" } }] }
router.patch(
  '/:id/disponibilidad/agregar',
  autenticar,
  verificarSiAdmin,
  validarObjetoJson,
  profesorController.agregarDisponibilidad
);
router.patch(
  '/:id/disponibilidad/quitar',
  autenticar,
  verificarSiAdmin,
  validarObjetoJson,
  profesorController.quitarDisponibilidad
);

export default router;
