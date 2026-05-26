/**
 * Clases de error personalizadas
 * Proporciona estructura consistente para manejar diferentes tipos de errores
 */

/**
 * Clase base para todos los errores de la aplicación
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error para recursos no encontrados
 */
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} no encontrado`, 404);
  }
}

/**
 * Error para validación de datos
 */
export class ValidationError extends AppError {
  details?: Record<string, any>;

  constructor(message: string, details: Record<string, any> = {}) {
    super(message, 400);
    this.details = details;
  }
}

/**
 * Error de acceso no autorizado
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'No autorizado') {
    super(message, 401);
  }
}

/**
 * Error de acceso prohibido
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Acceso prohibido') {
    super(message, 403);
  }
}

/**
 * Error de conflicto (ej: duplicado)
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}
