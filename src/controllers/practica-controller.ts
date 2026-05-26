/**
 * Controlador de Prácticas
 * Orquesta las solicitudes HTTP con la lógica de negocio
 */

import { Request, Response } from 'express';
import { practicaService } from '../services/practica-service';

class PracticaController {
  /**
   * GET /api/practicas/grupo/:grupoId
   * Obtiene prácticas de un grupo
   */
  async getPracticasByGrupo(req: Request, res: Response): Promise<void> {
    const { grupoId } = req.params;

    const practicas = await practicaService.getPracticasByGrupo(Number(grupoId));

    res.json({
      success: true,
      data: practicas,
      count: practicas.length,
    });
  }

  /**
   * GET /api/practicas/:practicaId
   * Obtiene detalle de una práctica
   */
  async getPracticaById(req: Request, res: Response): Promise<void> {
    const { practicaId } = req.params;

    const practica = await practicaService.getPracticaById(practicaId);

    res.json({
      success: true,
      data: practica,
    });
  }

  /**
   * GET /api/practicas/vencidas/sin-calificar
   * Obtiene prácticas vencidas que no han sido calificadas
   */
  async getOverdueUncalified(req: Request, res: Response): Promise<void> {
    const practicas = await practicaService.getOverdueUncalified();

    res.json({
      success: true,
      data: practicas,
      count: practicas.length,
      message: `Hay ${practicas.length} prácticas vencidas sin calificar`,
    });
  }

  /**
   * POST /api/practicas
   * Crea una nueva práctica
   */
  async createPractica(req: Request, res: Response): Promise<void> {
    const practica = await practicaService.createPractica(req.body);

    res.status(201).json({
      success: true,
      data: practica,
      message: 'Práctica creada exitosamente',
    });
  }

  /**
   * PUT /api/practicas/:practicaId
   * Actualiza información de una práctica
   */
  async updatePractica(req: Request, res: Response): Promise<void> {
    const { practicaId } = req.params;

    const practica = await practicaService.updatePractica(practicaId, req.body);

    res.json({
      success: true,
      data: practica,
      message: 'Práctica actualizada exitosamente',
    });
  }

  /**
   * PATCH /api/practicas/:practicaId/calificar
   * Califica una práctica
   */
  async calificarPractica(req: Request, res: Response): Promise<void> {
    const { practicaId } = req.params;
    const { calificacion } = req.body;

    const practica = await practicaService.calificarPractica(practicaId, calificacion);

    res.json({
      success: true,
      data: practica,
      message: 'Práctica calificada exitosamente',
    });
  }

  /**
   * PATCH /api/practicas/:practicaId/marcar-entregada
   * Marca una práctica como entregada
   */
  async markAsDelivered(req: Request, res: Response): Promise<void> {
    const { practicaId } = req.params;

    const practica = await practicaService.markAsDelivered(practicaId);

    res.json({
      success: true,
      data: practica,
      message: 'Práctica marcada como entregada',
    });
  }
}

export const practicaController = new PracticaController();
