/**
 * Repositorio para Grupos
 * Maneja todas las operaciones de BD relacionadas con grupos
 */

import { BaseRepository } from './base-repository';
import { pool } from '../db';

export interface Grupo {
  id: number;
  nombre: string;
  docente: string;
  semester?: string;
  horario?: string;
  salon?: string;
  activo: boolean;
}

export class GrupoRepository extends BaseRepository<Grupo> {
  constructor() {
    super('grupos');
  }

  /**
   * Obtiene todos los grupos ordenados por nombre
   */
  async findAll(): Promise<Grupo[]> {
    return super.findAll('nombre ASC');
  }

  /**
   * Obtiene grupos activos
   */
  async findActive(): Promise<Grupo[]> {
    return this.findWhere('activo = $1', [true]);
  }

  /**
   * Obtiene grupos por docente
   */
  async findByDocente(docente: string): Promise<Grupo[]> {
    return this.findWhere('docente = $1 ORDER BY nombre ASC', [docente]);
  }

  /**
   * Cuenta estudiantes en un grupo
   */
  async countEstudiantes(grupoId: number): Promise<number> {
    const result = await pool.query(
      'SELECT COUNT(*) FROM estudiantes_grupos WHERE grupo_id = $1',
      [grupoId]
    );
    return parseInt(result.rows[0].count, 10);
  }
}

export const grupoRepository = new GrupoRepository();
