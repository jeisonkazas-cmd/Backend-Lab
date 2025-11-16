// src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    return res.status(401).json({ error: "No autenticado" });
  }
  next();
}

export function requireRole(
  roles: Array<"Estudiante" | "Docente" | "Administrador">
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.session.user;

    if (!user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    if (!user.rol_plataforma || !roles.includes(user.rol_plataforma as any)) {
      return res.status(403).json({ error: "No autorizado" });
    }

    next();
  };
}
