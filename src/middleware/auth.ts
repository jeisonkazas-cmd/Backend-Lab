import { Router } from "express";
import { pool } from "../db";
import { requireSupabaseAuth, requireSupabaseRole } from "./supabase-auth";

export const requireAuth = requireSupabaseAuth;
export const requireRole = requireSupabaseRole;

const router = Router();

router.get("/me", requireSupabaseAuth, async (req, res) => {
  try {
    const supabaseUser = req.supabaseUser;

    if (!supabaseUser?.sub) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const entraOid = supabaseUser.sub;
    const correo = supabaseUser.email ?? "";
    const nombre = correo;

    let result = await pool.query(
      `
      SELECT
        u.usuario_id,
        u.entra_oid,
        u.correo,
        u.nombre_completo,
        u.estado,
        r.nombre AS rol
      FROM usuarios u
      LEFT JOIN usuarios_roles ur ON ur.usuario_id = u.usuario_id
      LEFT JOIN roles r ON r.rol_id = ur.rol_id
      WHERE u.entra_oid = $1
      LIMIT 1
      `,
      [entraOid]
    );

    let perfil = result.rows[0];

    if (!perfil) {
      await pool.query(
        `
        INSERT INTO usuarios (entra_oid, correo, nombre_completo, estado)
        VALUES ($1, $2, $3, 'pendiente')
        ON CONFLICT (entra_oid) DO NOTHING
        `,
        [entraOid, correo, nombre]
      );

      result = await pool.query(
        `
        SELECT
          u.usuario_id,
          u.entra_oid,
          u.correo,
          u.nombre_completo,
          u.estado,
          r.nombre AS rol
        FROM usuarios u
        LEFT JOIN usuarios_roles ur ON ur.usuario_id = u.usuario_id
        LEFT JOIN roles r ON r.rol_id = ur.rol_id
        WHERE u.entra_oid = $1
        LIMIT 1
        `,
        [entraOid]
      );

      perfil = result.rows[0];
    }

    return res.json({
      user: {
        id: entraOid,
        email: correo,
      },
      perfil,
      rol: perfil?.rol ?? null,
    });
  } catch (error) {
    console.error("Error en /auth/me:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;
