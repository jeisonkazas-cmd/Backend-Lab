/**
 * Rutas de Grupos (API REST)
 * Todas las rutas relacionadas con la gestión de grupos
 */

import express from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validateIdParam, validateBodyNotEmpty, validateRequiredFields } from '../middleware/validation';
import { grupoController } from '../controllers/grupo-controller';

const router = express.Router();

/**
 * GET /api/grupos
 * Obtiene todos los grupos
 */
router.get('/', asyncHandler(async (req, res) => grupoController.getAllGrupos(req, res)));

/**
 * GET /api/grupos/activos
 * Nota: Esta ruta debe ir ANTES de /:grupoId para evitar que "activos" se interprete como ID
 */
router.get('/activos', asyncHandler(async (req, res) => grupoController.getActiveGrupos(req, res)));

/**
 * GET /api/grupos/:grupoId
 * Obtiene un grupo específico
 */
router.get('/:grupoId', validateIdParam('grupoId'), asyncHandler(async (req, res) => grupoController.getGrupoById(req, res)));

/**
 * GET /api/grupos/docente/:docenteName
 * Obtiene grupos de un docente
 */
router.get('/docente/:docente', asyncHandler(async (req, res) => grupoController.getGruposByDocente(req, res)));

/**
 * POST /api/grupos
 * Crea un nuevo grupo
 */
router.post(
  '/',
  validateBodyNotEmpty,
  validateRequiredFields(['nombre', 'docente']),
  asyncHandler(async (req, res) => grupoController.createGrupo(req, res))
);

/**
 * PUT /api/grupos/:grupoId
 * Actualiza un grupo
 */
router.put(
  '/:grupoId',
  validateIdParam('grupoId'),
  validateBodyNotEmpty,
  asyncHandler(async (req, res) => grupoController.updateGrupo(req, res))
);

export default router;
