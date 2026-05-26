/**
 * Middleware centralizado de manejo de errores
 * Captura todos los errores y responde con estructura consistente
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

/**
 * Middleware de error global
 * Debe ser registrado ÚLTIMO en app.use()
 */
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Establecer valores por defecto
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Error interno del servidor';

  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', {
      statusCode,
      message,
      stack: err.stack,
      details: err.details,
    });
  } else {
    console.error(`[${new Date().toISOString()}] ${statusCode} - ${message}`);
  }

  // Estructura de respuesta consistente
  const response: any = {
    success: false,
    statusCode,
    message,
  };

  // Incluir detalles de validación si existen
  if (err.details) {
    response.details = err.details;
  }

  // En desarrollo, incluir stack trace; en producción, no exponer detalles internos
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

/**
 * Middleware para manejar rutas no encontradas
 */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    statusCode: 404,
    message: `No se encontró la ruta: ${req.originalUrl}`,
  });
};
