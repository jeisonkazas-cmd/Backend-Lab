/**
 * Repositorio para Posts del Foro
 * Maneja todas las operaciones de BD relacionadas con el foro
 */

import { BaseRepository } from './base-repository';
import { pool } from '../db';
import { NotFoundError } from '../utils/errors';

export interface ForoPost {
  id: number;
  practica_id: number;
  autor: string;
  rol: string;
  contenido: string;
  timestamp: Date;
  visitas: number;
  respuestas: number;
}

export class ForoPostRepository extends BaseRepository<ForoPost> {
  constructor() {
    super('foro_posts');
  }

  /**
   * Obtiene posts de una práctica
   */
  async findByPracticaId(practicaId: number): Promise<ForoPost[]> {
    return this.findWhere(
      'practica_id = $1 ORDER BY timestamp DESC',
      [practicaId]
    );
  }

  /**
   * Obtiene posts recientes
   */
  async findRecent(limit: number = 10): Promise<ForoPost[]> {
    const query = `
      SELECT * FROM foro_posts
      ORDER BY timestamp DESC
      LIMIT $1
    `;
    const result = await pool.query(query, [limit]);
    return result.rows as ForoPost[];
  }

  /**
   * Incrementa visitas de un post
   */
  async incrementVisitas(id: number): Promise<ForoPost> {
    const query = `
      UPDATE foro_posts 
      SET visitas = visitas + 1 
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Post');
    }

    return result.rows[0] as ForoPost;
  }

  /**
   * Incrementa respuestas de un post
   */
  async incrementRespuestas(id: number): Promise<ForoPost> {
    const query = `
      UPDATE foro_posts 
      SET respuestas = respuestas + 1 
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Post');
    }

    return result.rows[0] as ForoPost;
  }

  /**
   * Obtiene posts por autor
   */
  async findByAutor(autor: string): Promise<ForoPost[]> {
    return this.findWhere(
      'autor = $1 ORDER BY timestamp DESC',
      [autor]
    );
  }
}

export const foroPostRepository = new ForoPostRepository();
