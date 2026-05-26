import { foroPostRepository, ForoPost } from '../repositories/foro-post-repository';
import { practicaRepository } from '../repositories/practica-repository';
import { ValidationError } from '../utils/errors';

export interface CreatePostData {
  practica_id: number;
  autor: string;
  rol?: string;
  contenido: string;
}

export interface UpdatePostData {
  contenido: string;
}

class ForoService {
  async getPostsByPractica(practicaId: number): Promise<ForoPost[]> {
    await practicaRepository.findById(practicaId);
    return foroPostRepository.findByPracticaId(practicaId);
  }

  async getPostById(postId: number): Promise<ForoPost> {
    return foroPostRepository.findById(postId);
  }

  async getRecentPosts(limit: string | number = 10): Promise<ForoPost[]> {
    const validLimit = Math.min(Math.max(parseInt(String(limit), 10), 1), 100);
    return foroPostRepository.findRecent(validLimit);
  }

  async createPost(postData: CreatePostData): Promise<ForoPost> {
    const { practica_id, autor, rol, contenido } = postData;

    if (!practica_id || !autor || !contenido) {
      throw new ValidationError('practica_id, autor y contenido son obligatorios');
    }

    await practicaRepository.findById(practica_id);

    const validRoles = ['estudiante', 'docente', 'admin'];
    if (rol && !validRoles.includes(rol)) {
      throw new ValidationError(
        `rol debe ser uno de: ${validRoles.join(', ')}`
      );
    }

    if (contenido.trim().length === 0) {
      throw new ValidationError('El contenido del post no puede estar vacío');
    }

    if (contenido.length > 5000) {
      throw new ValidationError('El contenido no puede exceder 5000 caracteres');
    }

    const data = {
      practica_id,
      autor: autor.trim(),
      rol: rol || 'estudiante',
      contenido: contenido.trim(),
      timestamp: new Date(),
      visitas: 0,
      respuestas: 0,
    };

    return foroPostRepository.create(data);
  }

  /**
   * Registra una visualización de un post
   */
  async viewPost(postId: number): Promise<ForoPost> {
    return foroPostRepository.incrementVisitas(postId);
  }

  /**
   * Registra una nueva respuesta a un post
   */
  async addResponse(postId: number): Promise<ForoPost> {
    return foroPostRepository.incrementRespuestas(postId);
  }

  /**
   * Obtiene posts de un autor
   */
  async getPostsByAutor(autor: string): Promise<ForoPost[]> {
    return foroPostRepository.findByAutor(autor);
  }

  /**
   * Actualiza un post
   */
  async updatePost(postId: number, postData: UpdatePostData): Promise<ForoPost> {
    // Verificar que existe
    await foroPostRepository.findById(postId);

    // Solo permitir actualizar contenido
    const { contenido } = postData;

    if (!contenido) {
      throw new ValidationError('contenido es requerido');
    }

    if (contenido.trim().length === 0) {
      throw new ValidationError('El contenido del post no puede estar vacío');
    }

    if (contenido.length > 5000) {
      throw new ValidationError('El contenido no puede exceder 5000 caracteres');
    }

    return foroPostRepository.update(postId, { contenido: contenido.trim() });
  }
}

export const foroService = new ForoService();
