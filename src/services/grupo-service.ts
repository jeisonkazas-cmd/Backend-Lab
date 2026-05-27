import { grupoRepository, Grupo } from '../repositories/grupo-repository';
import { ValidationError } from '../utils/errors';

export interface CreateGrupoData {
  nombre: string;
  docente: string;
  semester?: string;
  horario?: string;
  salon?: string;
  activo?: boolean;
}

export interface UpdateGrupoData {
  nombre?: string;
  docente?: string;
  semester?: string;
  horario?: string;
  salon?: string;
  activo?: boolean;
}

class GrupoService {
  async getAllGrupos(): Promise<Grupo[]> {
    return grupoRepository.findAll();
  }

  async getGrupoById(grupoId: number | string): Promise<Grupo> {
    return grupoRepository.findById(grupoId);
  }

  async getActiveGrupos(): Promise<Grupo[]> {
    return grupoRepository.findActive();
  }

  async getGruposByDocente(docente: string): Promise<Grupo[]> {
    return grupoRepository.findByDocente(docente);
  }

  async createGrupo(grupoData: CreateGrupoData): Promise<Grupo> {
    const { nombre, docente, semester, horario, salon, activo } = grupoData;

    if (!nombre || !docente) {
      throw new ValidationError('Nombre y docente son obligatorios');
    }

    const data = {
      nombre,
      docente,
      semester: semester || null,
      horario: horario || null,
      salon: salon || null,
      activo: activo !== false,
    };

    return grupoRepository.create(data);
  }

  async updateGrupo(grupoId: number | string, grupoData: UpdateGrupoData): Promise<Grupo> {
    // Primero verificar que existe
    await grupoRepository.findById(grupoId);

    // Filtrar solo campos permitidos
    const allowedFields = ['nombre', 'docente', 'semester', 'horario', 'salon', 'activo'];
    const filteredData: Record<string, any> = {};

    Object.keys(grupoData).forEach((key) => {
      if (allowedFields.includes(key)) {
        filteredData[key] = (grupoData as Record<string, any>)[key];
      }
    });

    if (Object.keys(filteredData).length === 0) {
      throw new ValidationError('No hay campos válidos para actualizar');
    }

    return grupoRepository.update(grupoId, filteredData);
  }

  async getEstudianteCount(grupoId: number | string): Promise<number> {
    await grupoRepository.findById(grupoId);
    return grupoRepository.countEstudiantes(Number(grupoId));
  }
}

export const grupoService = new GrupoService();
