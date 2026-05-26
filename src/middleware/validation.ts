import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/errors';

export const validateIdParam = (paramName: string = 'id') => 
  (req: Request, res: Response, next: NextFunction) => {
    const id = req.params[paramName];

    if (!id || isNaN(Number(id)) || parseInt(id, 10) <= 0) {
      throw new ValidationError(`El parámetro '${paramName}' debe ser un número positivo válido`);
    }

    req.params[paramName] = parseInt(id, 10).toString();
    next();
  };

export const validateBodyNotEmpty = (req: Request, res: Response, next: NextFunction) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    throw new ValidationError('El cuerpo de la solicitud no puede estar vacío');
  }
  next();
};

export const validateRequiredFields = (fields: string[]) => 
  (req: Request, res: Response, next: NextFunction) => {
    const missingFields = fields.filter((field) => !req.body[field]);

    if (missingFields.length > 0) {
      throw new ValidationError(
        `Los siguientes campos son requeridos: ${missingFields.join(', ')}`
      );
    }

    next();
  };
