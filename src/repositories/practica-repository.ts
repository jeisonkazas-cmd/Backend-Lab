/**
 * Repositorio para Prácticas
 * Maneja todas las operaciones de BD relacionadas con prácticas
 */

import { BaseRepository } from './base-repository';
import { pool } from '../db';
import { NotFoundError } from '../utils/errors';

export interface Practica {
  id: number;
  grupo_id: number;
  titulo: string;
  descripcion?: string;
  html_url?: string;
  informe_url?: string;
  tipo: 'virtual' | 'presencial' | 'remota';
  estado: string;
  fecha_entrega?: Date;
  fecha_calificacion?: Date;
  calificacion?: number;
  instrucciones?: string;
}

export class PracticaRepository extends BaseRepository<Practica> {
  constructor() {
    super('practicas');
  }

  /**
   * Obtiene prácticas de un grupo
   */
  async findByGrupoId(grupoId: number): Promise<Practica[]> {
    return this.findWhere(
      'grupo_id = $1 ORDER BY fecha_entrega ASC',
      [grupoId]
    );
  }

  /**
   * Obtiene una práctica con todas sus columnas
   */
  async findById(id: string | number): Promise<Practica> {
    const query = `
      SELECT 
        id, grupo_id, titulo, descripcion, html_url, informe_url,
        tipo, estado, fecha_entrega, fecha_calificacion, calificacion, instrucciones
      FROM practicas
      WHERE id = $1
    `;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Práctica');
    }

    return result.rows[0] as Practica;
  }

  /**
   * Actualiza solo estado y calificación
   */
  async updateCalificacion(
    id: string | number,
    estado?: string,
    calificacion?: number
  ): Promise<Practica> {
    const query = `
      UPDATE practicas 
      SET 
        estado = COALESCE($2, estado),
        calificacion = COALESCE($3, calificacion),
        fecha_calificacion = CASE WHEN $2 = 'calificado' THEN NOW() ELSE fecha_calificacion END
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id, estado, calificacion]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Práctica');
    }

    return result.rows[0] as Practica;
  }

  /**
   * Obtiene prácticas vencidas sin calificar
   */
  async findOverdueUncalified(): Promise<Practica[]> {
    const query = `
      SELECT * FROM practicas
      WHERE estado != 'calificado' AND fecha_entrega < NOW()
      ORDER BY fecha_entrega ASC
    `;
    const result = await pool.query(query);
    return result.rows as Practica[];
  }
}

export const practicaRepository = new PracticaRepository();
