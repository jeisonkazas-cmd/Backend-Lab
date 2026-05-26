/**
 * Controlador de Foro
 * Orquesta las solicitudes HTTP con la lógica de negocio
 */

import { Request, Response } from 'express';
import { foroService } from '../services/foro-service';

class ForoController {
  /**
   * GET /api/foro/practica/:practicaId
   * Obtiene posts de una práctica
   */
  async getPostsByPractica(req: Request, res: Response): Promise<void> {
    const { practicaId } = req.params;

    const posts = await foroService.getPostsByPractica(Number(practicaId));

    res.json({
      success: true,
      data: posts,
      count: posts.length,
    });
  }

  /**
   * GET /api/foro/:postId
   * Obtiene un post específico e incrementa sus visitas
   */
  async getPostById(req: Request, res: Response): Promise<void> {
    const { postId } = req.params;

    const post = await foroService.viewPost(Number(postId));

    res.json({
      success: true,
      data: post,
    });
  }

  /**
   * GET /api/foro/recientes
   * Obtiene posts recientes del sistema
   */
  async getRecentPosts(req: Request, res: Response): Promise<void> {
    const limit = req.query.limit ? Number(req.query.limit) : 10;

    const posts = await foroService.getRecentPosts(limit);

    res.json({
      success: true,
      data: posts,
      count: posts.length,
    });
  }

  /**
   * POST /api/foro
   * Crea un nuevo post
   */
  async createPost(req: Request, res: Response): Promise<void> {
    const post = await foroService.createPost(req.body);

    res.status(201).json({
      success: true,
      data: post,
      message: 'Post creado exitosamente',
    });
  }

  /**
   * PUT /api/foro/:postId
   * Actualiza un post
   */
  async updatePost(req: Request, res: Response): Promise<void> {
    const { postId } = req.params;

    const post = await foroService.updatePost(Number(postId), req.body);

    res.json({
      success: true,
      data: post,
      message: 'Post actualizado exitosamente',
    });
  }

  /**
   * PATCH /api/foro/:postId/respuesta
   * Incrementa contador de respuestas de un post
   */
  async addResponse(req: Request, res: Response): Promise<void> {
    const { postId } = req.params;

    const post = await foroService.addResponse(Number(postId));

    res.json({
      success: true,
      data: post,
      message: 'Respuesta registrada',
    });
  }

  /**
   * GET /api/foro/autor/:autor
   * Obtiene posts de un autor específico
   */
  async getPostsByAutor(req: Request, res: Response): Promise<void> {
    const { autor } = req.params;

    const posts = await foroService.getPostsByAutor(autor);

    res.json({
      success: true,
      data: posts,
      count: posts.length,
    });
  }
}

export const foroController = new ForoController();
