import express from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validateIdParam, validateBodyNotEmpty, validateRequiredFields } from '../middleware/validation';
import { grupoController } from '../controllers/grupo-controller';

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => grupoController.getAllGrupos(req, res)));

router.get('/activos', asyncHandler(async (req, res) => grupoController.getActiveGrupos(req, res)));

router.get('/:grupoId', validateIdParam('grupoId'), asyncHandler(async (req, res) => grupoController.getGrupoById(req, res)));

router.get('/docente/:docente', asyncHandler(async (req, res) => grupoController.getGruposByDocente(req, res)));

router.post(
  '/',
  validateBodyNotEmpty,
  validateRequiredFields(['nombre', 'docente']),
  asyncHandler(async (req, res) => grupoController.createGrupo(req, res))
);

router.put(
  '/:grupoId',
  validateIdParam('grupoId'),
  validateBodyNotEmpty,
  asyncHandler(async (req, res) => grupoController.updateGrupo(req, res))
);

export default router;
