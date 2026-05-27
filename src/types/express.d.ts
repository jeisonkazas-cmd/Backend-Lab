import "express";

declare global {
  namespace Express {
    interface Request {
      supabaseUser?: {
        sub: string;
        email?: string;
      };
      supabaseProfile?: {
        usuario_id: number;
        correo: string;
        nombre_completo: string;
        estado: string;
        rol: string | null;
      };
    }
  }
}

export {};
