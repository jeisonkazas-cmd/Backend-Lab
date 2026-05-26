/**
 * Rutas de Foro (API REST)
 * Todas las rutas relacionadas con el foro de discusión
 */

import express from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validateIdParam, validateBodyNotEmpty, validateRequiredFields } from '../middleware/validation';
import { foroController } from '../controllers/foro-controller';

const router = express.Router();

/**
 * GET /api/foro/recientes
 * Nota: Esta ruta debe ir ANTES de /:postId para evitar conflictos
 */
router.get('/recientes', asyncHandler(async (req, res) => foroController.getRecentPosts(req, res)));

/**
 * GET /api/foro/practica/:practicaId
 * Obtiene posts del foro de una práctica específica
 */
router.get('/practica/:practicaId', validateIdParam('practicaId'), asyncHandler(async (req, res) => foroController.getPostsByPractica(req, res)));

/**
 * GET /api/foro/autor/:autor
 * Obtiene posts de un autor específico
 */
router.get('/autor/:autor', asyncHandler(async (req, res) => foroController.getPostsByAutor(req, res)));

/**
 * GET /api/foro/:postId
 * Obtiene un post específico (incrementa visitas)
 */
router.get('/:postId', validateIdParam('postId'), asyncHandler(async (req, res) => foroController.getPostById(req, res)));

/**
 * POST /api/foro
 * Crea un nuevo post
 */
router.post(
  '/',
  validateBodyNotEmpty,
  validateRequiredFields(['practica_id', 'autor', 'contenido']),
  asyncHandler(async (req, res) => foroController.createPost(req, res))
);

/**
 * PUT /api/foro/:postId
 * Actualiza un post
 */
router.put(
  '/:postId',
  validateIdParam('postId'),
  validateBodyNotEmpty,
  validateRequiredFields(['contenido']),
  asyncHandler(async (req, res) => foroController.updatePost(req, res))
);

/**
 * PATCH /api/foro/:postId/respuesta
 * Registra una nueva respuesta a un post
 */
router.patch(
  '/:postId/respuesta',
  validateIdParam('postId'),
  asyncHandler(async (req, res) => foroController.addResponse(req, res))
);

export default router;
