import { Router } from "express";
import { pool } from "../db";
import { requireSupabaseAuth } from "../middleware/supabase-auth";

const router = Router();

router.get("/me", requireSupabaseAuth, async (req, res) => {
  const entraOid = req.supabaseUser?.sub;
  const emailFromToken = req.supabaseUser?.email;

  if (!entraOid) {
    return res.status(401).json({ error: "No autenticado" });
  }

  try {
    // 1) Buscar por entra_oid
    let result = await pool.query(
      `SELECT
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
       LIMIT 1`,
      [entraOid]
    );

    let profile = result.rows[0];

    // 2) Si no existe por entra_oid, buscar por correo y “enganchar” entra_oid
    if (!profile && emailFromToken) {
      const byEmail = await pool.query(
        `SELECT
           u.usuario_id,
           u.entra_oid,
           u.correo,
           u.nombre_completo,
           u.estado,
           r.nombre AS rol
         FROM usuarios u
         LEFT JOIN usuarios_roles ur ON ur.usuario_id = u.usuario_id
         LEFT JOIN roles r ON r.rol_id = ur.rol_id
         WHERE u.correo = $1
         LIMIT 1`,
        [emailFromToken]
      );

      profile = byEmail.rows[0];

      if (profile && profile.entra_oid !== entraOid) {
        await pool.query(
          `UPDATE usuarios
           SET entra_oid = $1
           WHERE usuario_id = $2`,
          [entraOid, profile.usuario_id]
        );

        // Releer ya actualizado
        const reread = await pool.query(
          `SELECT
             u.usuario_id,
             u.entra_oid,
             u.correo,
             u.nombre_completo,
             u.estado,
             r.nombre AS rol
           FROM usuarios u
           LEFT JOIN usuarios_roles ur ON ur.usuario_id = u.usuario_id
           LEFT JOIN roles r ON r.rol_id = ur.rol_id
           WHERE u.usuario_id = $1
           LIMIT 1`,
          [profile.usuario_id]
        );
        profile = reread.rows[0];
      }
    }

    // 3) Si no existe, crear como pendiente
    if (!profile) {
      const correo = emailFromToken || "";
      const nombre = emailFromToken || "";

      const inserted = await pool.query(
        `INSERT INTO usuarios (entra_oid, correo, nombre_completo, estado)
         VALUES ($1, $2, $3, 'pendiente')
         RETURNING usuario_id, entra_oid, correo, nombre_completo, estado`,
        [entraOid, correo, nombre]
      );

      const insertedRow = inserted.rows[0];
      profile = {
        ...insertedRow,
        rol: null,
      };
    }

    return res.json({
      perfil: {
        usuario_id: profile.usuario_id,
        entra_oid: profile.entra_oid,
        correo: profile.correo,
        nombre_completo: profile.nombre_completo,
        estado: profile.estado,
      },
      rol: profile.rol ?? null,
    });
  } catch (err) {
    console.error("Error resolviendo perfil en /api/auth/me:", err);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;
