import express from 'express';
import { asyncHandler } from '../utils/async-handler';
import { validateIdParam, validateBodyNotEmpty, validateRequiredFields } from '../middleware/validation';
import { foroController } from '../controllers/foro-controller';

const router = express.Router();

router.get('/recientes', asyncHandler(async (req, res) => foroController.getRecentPosts(req, res)));

router.get('/practica/:practicaId', validateIdParam('practicaId'), asyncHandler(async (req, res) => foroController.getPostsByPractica(req, res)));

router.get('/autor/:autor', asyncHandler(async (req, res) => foroController.getPostsByAutor(req, res)));

router.get('/:postId', validateIdParam('postId'), asyncHandler(async (req, res) => foroController.getPostById(req, res)));

router.post(
  '/',
  validateBodyNotEmpty,
  validateRequiredFields(['practica_id', 'autor', 'contenido']),
  asyncHandler(async (req, res) => foroController.createPost(req, res))
);

router.put(
  '/:postId',
  validateIdParam('postId'),
  validateBodyNotEmpty,
  validateRequiredFields(['contenido']),
  asyncHandler(async (req, res) => foroController.updatePost(req, res))
);

router.patch(
  '/:postId/respuesta',
  validateIdParam('postId'),
  asyncHandler(async (req, res) => foroController.addResponse(req, res))
);

export default router;
