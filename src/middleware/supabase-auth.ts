import type { NextFunction, Request, Response } from "express";
import { pool } from "../db";

function getBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL;
  if (!url) {
    throw new Error("SUPABASE_URL no está definida");
  }
  return url.replace(/\/$/, "");
}

let joseModulePromise: Promise<any> | null = null;
function getJose() {
  if (!joseModulePromise) {
    joseModulePromise = import("jose");
  }
  return joseModulePromise;
}

let jwks: any | null = null;
async function getJwks() {
  if (jwks) return jwks;
  const { createRemoteJWKSet } = await getJose();
  const supabaseUrl = getSupabaseUrl();
  jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/keys`));
  return jwks;
}

export async function requireSupabaseAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: "No autenticado" });
  }

  const supabaseUrl = getSupabaseUrl();
  const issuer = process.env.SUPABASE_JWT_ISSUER || `${supabaseUrl}/auth/v1`;
  const audience = process.env.SUPABASE_JWT_AUDIENCE || "authenticated";

  try {
    const { jwtVerify } = await getJose();
    const jwksKeySet = await getJwks();

    const { payload } = await jwtVerify(token, jwksKeySet, {
      issuer,
      audience,
    });

    const sub = payload.sub;
    if (!sub || typeof sub !== "string") {
      return res.status(401).json({ error: "Token inválido" });
    }

    const emailClaim = payload.email;

    req.supabaseUser = {
      sub,
      email: typeof emailClaim === "string" ? emailClaim : undefined,
    };

    return next();
  } catch (err) {
    console.error("Error verificando JWT Supabase:", err);
    return res.status(401).json({ error: "No autenticado" });
  }
}

export function requireSupabaseRole(roles: Array<"Estudiante" | "Docente" | "Administrador">) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.supabaseUser?.sub) {
      return res.status(401).json({ error: "No autenticado" });
    }

    try {
      const result = await pool.query(
        `SELECT
           u.usuario_id,
           u.correo,
           u.nombre_completo,
           u.estado,
           r.nombre AS rol
         FROM usuarios u
         LEFT JOIN usuarios_roles ur ON ur.usuario_id = u.usuario_id
         LEFT JOIN roles r ON r.rol_id = ur.rol_id
         WHERE u.entra_oid = $1
         LIMIT 1`,
        [req.supabaseUser.sub]
      );

      const profile = result.rows[0];
      if (!profile) {
        return res.status(403).json({ error: "No autorizado" });
      }

      req.supabaseProfile = profile;

      if (profile.estado !== "activo") {
        return res.status(403).json({ error: "Cuenta no activa" });
      }

      const rol = profile.rol as string | null;
      if (!rol || !roles.includes(rol as any)) {
        return res.status(403).json({ error: "No autorizado" });
      }

      return next();
    } catch (err) {
      console.error("Error resolviendo rol Supabase:", err);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  };
}
