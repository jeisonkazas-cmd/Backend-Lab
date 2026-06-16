import type { NextFunction, Request, Response } from "express";
import { pool } from "../db";
import jwt from "jsonwebtoken";

function getBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL || process.env.POSTGRES_SUPABASE_URL;
  if (!url) {
    throw new Error("SUPABASE_URL o POSTGRES_SUPABASE_URL no esta definida");
  }
  return url.replace(/\/$/, "");
}

function getSupabaseJwtSecret(): string | null {
  return (
    process.env.SUPABASE_JWT_SECRET ||
    process.env.POSTGRES_SUPABASE_JWT_SECRET ||
    null
  );
}

function getSupabaseApiKey(): string | null {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.POSTGRES_SUPABASE_ANON_KEY ||
    process.env.POSTGRES_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_POSTGRES_SUPABASE_PUBLISHABLE_KEY ||
    process.env.POSTGRES_SUPABASE_SERVICE_ROLE_KEY ||
    null
  );
}

async function validateTokenWithSupabaseAuthApi(token: string) {
  const supabaseUrl = getSupabaseUrl();
  const apiKey = getSupabaseApiKey();

  if (!apiKey) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY o SUPABASE_ANON_KEY para validar token con Supabase Auth");
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: apiKey,
      authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase Auth rechazo el token: ${response.status}`);
  }

  const user = await response.json() as { id?: string; email?: string };
  if (!user.id) {
    throw new Error("Supabase Auth no devolvio usuario");
  }

  return {
    sub: user.id,
    email: user.email,
  };
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

  const audience = process.env.SUPABASE_JWT_AUDIENCE || "authenticated";

  try {
    const secret = getSupabaseJwtSecret();

    let payload: any;

    const decoded = jwt.decode(token, { complete: true }) as any;
    const alg = decoded?.header?.alg;

    // Si el token estÃ¡ firmado con HS256, podemos validar con el JWT_SECRET.
    if (alg === "HS256") {
      if (!secret) {
        return res.status(500).json({
          error: "ConfiguraciÃ³n incompleta",
          message:
            "Falta SUPABASE_JWT_SECRET o POSTGRES_SUPABASE_JWT_SECRET para validar tokens HS256",
        });
      }

      payload = jwt.verify(token, secret, {
        algorithms: ["HS256"],
        audience,
      });
    } else {
      // Para RS256/otros algoritmos, validamos contra JWKS remoto.
      // Esto requiere POSTGRES_SUPABASE_URL para construir el endpoint /auth/v1/keys.
      let supabaseUrl: string;
      try {
        supabaseUrl = getSupabaseUrl();
      } catch {
        return res.status(500).json({
          error: "ConfiguraciÃ³n incompleta",
          message:
            "POSTGRES_SUPABASE_URL no estÃ¡ definida (necesaria para validar tokens RS256 via JWKS)",
        });
      }

      const issuer = process.env.SUPABASE_JWT_ISSUER || `${supabaseUrl}/auth/v1`;

      const { jwtVerify } = await getJose();
      const jwksKeySet = await getJwks();

      const verified = await jwtVerify(token, jwksKeySet, {
        issuer,
        audience,
      });

      payload = verified.payload;
    }

    const sub = payload.sub;
    if (!sub || typeof sub !== "string") {
      return res.status(401).json({ error: "Token invÃ¡lido" });
    }

    const emailClaim = payload.email;

    req.supabaseUser = {
      sub,
      email: typeof emailClaim === "string" ? emailClaim : undefined,
    };

    return next();
  } catch (err) {
    try {
      const fallbackUser = await validateTokenWithSupabaseAuthApi(token);
      req.supabaseUser = fallbackUser;
      return next();
    } catch (fallbackErr) {
      console.error("Error verificando JWT Supabase:", err);
      console.error("Error verificando token contra Supabase Auth:", fallbackErr);
      return res.status(401).json({ error: "No autenticado" });
    }
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
      const dbError = err as { code?: string };
      return res.status(500).json({
        error: "No se pudo consultar el perfil/rol en la base de datos",
        code: dbError.code || null,
      });
    }
  };
}
