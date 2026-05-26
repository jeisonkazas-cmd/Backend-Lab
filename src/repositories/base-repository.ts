/**
 * Repositorio base para operaciones comunes de BD
 * Proporciona métodos reutilizables para CRUD básico
 */

import { pool } from '../db';
import { NotFoundError } from '../utils/errors';

export class BaseRepository<T> {
  constructor(private tableName: string) {}

  /**
   * Obtiene todos los registros de la tabla
   */
  async findAll(orderBy?: string): Promise<T[]> {
    const query = orderBy
      ? `SELECT * FROM ${this.tableName} ORDER BY ${orderBy}`
      : `SELECT * FROM ${this.tableName}`;

    const result = await pool.query(query);
    return result.rows as T[];
  }

  /**
   * Obtiene un registro por ID
   */
  async findById(id: string | number): Promise<T> {
    const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      throw new NotFoundError(`Registro en ${this.tableName}`);
    }

    return result.rows[0] as T;
  }

  /**
   * Obtiene registros que cumplan una condición
   */
  async findWhere(whereClause: string, values: any[]): Promise<T[]> {
    const query = `SELECT * FROM ${this.tableName} WHERE ${whereClause}`;
    const result = await pool.query(query, values);
    return result.rows as T[];
  }

  /**
   * Crea un nuevo registro
   */
  async create(data: Record<string, any>): Promise<T> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

    const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await pool.query(query, values);
    return result.rows[0] as T;
  }

  /**
   * Actualiza un registro
   */
  async update(id: string | number, data: Record<string, any>): Promise<T> {
    const columns = Object.keys(data);
    const values = [...Object.values(data), id];
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');

    const query = `UPDATE ${this.tableName} SET ${setClause} WHERE id = $${columns.length + 1} RETURNING *`;
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new NotFoundError(`Registro en ${this.tableName}`);
    }

    return result.rows[0] as T;
  }

  /**
   * Elimina un registro
   */
  async delete(id: string | number): Promise<{ id: string | number }> {
    const query = `DELETE FROM ${this.tableName} WHERE id = $1 RETURNING id`;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      throw new NotFoundError(`Registro en ${this.tableName}`);
    }

    return { id: result.rows[0].id };
  }
}
