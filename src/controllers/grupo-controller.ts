import { Request, Response } from 'express';
import { grupoService } from '../services/grupo-service';

class GrupoController {
  async getAllGrupos(req: Request, res: Response): Promise<void> {
    const grupos = await grupoService.getAllGrupos();

    res.json({
      success: true,
      data: grupos,
      count: grupos.length,
    });
  }

  async getActiveGrupos(req: Request, res: Response): Promise<void> {
    const grupos = await grupoService.getActiveGrupos();

    res.json({
      success: true,
      data: grupos,
      count: grupos.length,
    });
  }

  async getGrupoById(req: Request, res: Response): Promise<void> {
    const { grupoId } = req.params;

    const grupo = await grupoService.getGrupoById(grupoId);
    const estudianteCount = await grupoService.getEstudianteCount(grupoId);

    res.json({
      success: true,
      data: {
        ...grupo,
        estudianteCount,
      },
    });
  }

  async getGruposByDocente(req: Request, res: Response): Promise<void> {
    const { docente } = req.params;

    const grupos = await grupoService.getGruposByDocente(docente);

    res.json({
      success: true,
      data: grupos,
      count: grupos.length,
    });
  }

  async createGrupo(req: Request, res: Response): Promise<void> {
    const grupo = await grupoService.createGrupo(req.body);

    res.status(201).json({
      success: true,
      data: grupo,
      message: 'Grupo creado exitosamente',
    });
  }

  async updateGrupo(req: Request, res: Response): Promise<void> {
    const { grupoId } = req.params;

    const grupo = await grupoService.updateGrupo(grupoId, req.body);

    res.json({
      success: true,
      data: grupo,
      message: 'Grupo actualizado exitosamente',
    });
  }
}

export const grupoController = new GrupoController();
