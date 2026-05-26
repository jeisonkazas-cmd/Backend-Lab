/**
 * Middleware para manejar errores en funciones async
 * Envuelve funciones asíncronas para evitar repetir try/catch
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Wrapper para funciones async que automáticamente maneja errores
 * @param fn - Función async a envolver
 * @returns Función middleware express
 */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
