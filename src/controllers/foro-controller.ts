import { Request, Response } from 'express';
import { foroService } from '../services/foro-service';

class ForoController {
  async getPostsByPractica(req: Request, res: Response): Promise<void> {
    const { practicaId } = req.params;

    const posts = await foroService.getPostsByPractica(Number(practicaId));

    res.json({
      success: true,
      data: posts,
      count: posts.length,
    });
  }

  async getPostById(req: Request, res: Response): Promise<void> {
    const { postId } = req.params;

    const post = await foroService.viewPost(Number(postId));

    res.json({
      success: true,
      data: post,
    });
  }

  async getRecentPosts(req: Request, res: Response): Promise<void> {
    const limit = req.query.limit ? Number(req.query.limit) : 10;

    const posts = await foroService.getRecentPosts(limit);

    res.json({
      success: true,
      data: posts,
      count: posts.length,
    });
  }

  async createPost(req: Request, res: Response): Promise<void> {
    const post = await foroService.createPost(req.body);

    res.status(201).json({
      success: true,
      data: post,
      message: 'Post creado exitosamente',
    });
  }

  async updatePost(req: Request, res: Response): Promise<void> {
    const { postId } = req.params;

    const post = await foroService.updatePost(Number(postId), req.body);

    res.json({
      success: true,
      data: post,
      message: 'Post actualizado exitosamente',
    });
  }

  async addResponse(req: Request, res: Response): Promise<void> {
    const { postId } = req.params;

    const post = await foroService.addResponse(Number(postId));

    res.json({
      success: true,
      data: post,
      message: 'Respuesta registrada',
    });
  }

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
