import { practicaRepository, Practica } from '../repositories/practica-repository';
import { grupoRepository } from '../repositories/grupo-repository';
import { ValidationError } from '../utils/errors';

export interface CreatePracticaData {
  grupo_id: number;
  titulo: string;
  descripcion?: string;
  html_url?: string;
  informe_url?: string;
  tipo?: 'virtual' | 'presencial' | 'remota';
  estado?: string;
  fecha_entrega?: Date;
  instrucciones?: string;
}

export interface UpdatePracticaData {
  titulo?: string;
  descripcion?: string;
  html_url?: string;
  informe_url?: string;
  tipo?: string;
  estado?: string;
  fecha_entrega?: Date;
  instrucciones?: string;
}

class PracticaService {
  async getPracticasByGrupo(grupoId: number): Promise<Practica[]> {
    await grupoRepository.findById(grupoId);
    return practicaRepository.findByGrupoId(grupoId);
  }

  async getPracticaById(practicaId: number | string): Promise<Practica> {
    return practicaRepository.findById(practicaId);
  }

  async createPractica(practicaData: CreatePracticaData): Promise<Practica> {
    const {
      grupo_id,
      titulo,
      descripcion,
      html_url,
      informe_url,
      tipo,
      estado,
      fecha_entrega,
      instrucciones,
    } = practicaData;

    if (!grupo_id || !titulo) {
      throw new ValidationError('grupo_id y titulo son obligatorios');
    }

    await grupoRepository.findById(grupo_id);

    const validTypes = ['virtual', 'presencial', 'remota'];
    if (tipo && !validTypes.includes(tipo)) {
      throw new ValidationError(
        `tipo debe ser uno de: ${validTypes.join(', ')}`
      );
    }

    const data = {
      grupo_id,
      titulo,
      descripcion: descripcion || null,
      html_url: html_url || null,
      informe_url: informe_url || null,
      tipo: tipo || 'virtual',
      estado: estado || 'pendiente',
      fecha_entrega: fecha_entrega || null,
      instrucciones: instrucciones || null,
    };

    return practicaRepository.create(data);
  }

  /**
   * Actualiza información de una práctica
   */
  async updatePractica(practicaId: number | string, practicaData: UpdatePracticaData): Promise<Practica> {
    // Verificar que existe
    await practicaRepository.findById(practicaId);

    // Campos permitidos para actualizar
    const allowedFields = [
      'titulo',
      'descripcion',
      'html_url',
      'informe_url',
      'tipo',
      'estado',
      'fecha_entrega',
      'instrucciones',
    ];

    const filteredData: Record<string, any> = {};
    Object.keys(practicaData).forEach((key) => {
      if (allowedFields.includes(key)) {
        filteredData[key] = (practicaData as Record<string, any>)[key];
      }
    });

    if (Object.keys(filteredData).length === 0) {
      throw new ValidationError('No hay campos válidos para actualizar');
    }

    return practicaRepository.update(practicaId, filteredData);
  }

  /**
   * Califica una práctica
   */
  async calificarPractica(practicaId: number | string, calificacion: number): Promise<Practica> {
    // Validar calificación
    if (!calificacion || isNaN(calificacion) || calificacion < 0 || calificacion > 5) {
      throw new ValidationError('La calificación debe estar entre 0 y 5');
    }

    return practicaRepository.updateCalificacion(
      practicaId,
      'calificado',
      parseFloat(String(calificacion))
    );
  }

  /**
   * Obtiene prácticas vencidas sin calificar
   */
  async getOverdueUncalified(): Promise<Practica[]> {
    return practicaRepository.findOverdueUncalified();
  }

  /**
   * Marca una práctica como entregada
   */
  async markAsDelivered(practicaId: number | string): Promise<Practica> {
    return practicaRepository.updateCalificacion(practicaId, 'entregado', undefined);
  }
}

export const practicaService = new PracticaService();
