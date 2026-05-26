/**
 * Controlador de Grupos
 * Orquesta las solicitudes HTTP con la lógica de negocio
 */

import { Request, Response } from 'express';
import { grupoService } from '../services/grupo-service';

class GrupoController {
  /**
   * GET /api/grupos
   * Obtiene todos los grupos
   */
  async getAllGrupos(req: Request, res: Response): Promise<void> {
    const grupos = await grupoService.getAllGrupos();

    res.json({
      success: true,
      data: grupos,
      count: grupos.length,
    });
  }

  /**
   * GET /api/grupos/activos
   * Obtiene solo grupos activos
   */
  async getActiveGrupos(req: Request, res: Response): Promise<void> {
    const grupos = await grupoService.getActiveGrupos();

    res.json({
      success: true,
      data: grupos,
      count: grupos.length,
    });
  }

  /**
   * GET /api/grupos/:grupoId
   * Obtiene un grupo específico con información adicional
   */
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

  /**
   * GET /api/grupos/docente/:docente
   * Obtiene grupos de un docente específico
   */
  async getGruposByDocente(req: Request, res: Response): Promise<void> {
    const { docente } = req.params;

    const grupos = await grupoService.getGruposByDocente(docente);

    res.json({
      success: true,
      data: grupos,
      count: grupos.length,
    });
  }

  /**
   * POST /api/grupos
   * Crea un nuevo grupo
   */
  async createGrupo(req: Request, res: Response): Promise<void> {
    const grupo = await grupoService.createGrupo(req.body);

    res.status(201).json({
      success: true,
      data: grupo,
      message: 'Grupo creado exitosamente',
    });
  }

  /**
   * PUT /api/grupos/:grupoId
   * Actualiza un grupo
   */
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
