import { Request, Response } from 'express';
import { practicaService } from '../services/practica-service';

class PracticaController {
  async getPracticasByGrupo(req: Request, res: Response): Promise<void> {
    const { grupoId } = req.params;

    const practicas = await practicaService.getPracticasByGrupo(Number(grupoId));

    res.json({
      success: true,
      data: practicas,
      count: practicas.length,
    });
  }

  async getPracticaById(req: Request, res: Response): Promise<void> {
    const { practicaId } = req.params;

    const practica = await practicaService.getPracticaById(practicaId);

    res.json({
      success: true,
      data: practica,
    });
  }

  async getOverdueUncalified(req: Request, res: Response): Promise<void> {
    const practicas = await practicaService.getOverdueUncalified();

    res.json({
      success: true,
      data: practicas,
      count: practicas.length,
      message: `Hay ${practicas.length} prácticas vencidas sin calificar`,
    });
  }

  async createPractica(req: Request, res: Response): Promise<void> {
    const practica = await practicaService.createPractica(req.body);

    res.status(201).json({
      success: true,
      data: practica,
      message: 'Práctica creada exitosamente',
    });
  }

  async updatePractica(req: Request, res: Response): Promise<void> {
    const { practicaId } = req.params;

    const practica = await practicaService.updatePractica(practicaId, req.body);

    res.json({
      success: true,
      data: practica,
      message: 'Práctica actualizada exitosamente',
    });
  }

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
