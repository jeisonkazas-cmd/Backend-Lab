import { Router } from "express";
import { pool } from "../db";
import {
  ensureUserLastAccessColumn,
  requireSupabaseAuth,
  requireSupabaseRole,
} from "../middleware/supabase-auth";

const router = Router();

// Todas las rutas admin requieren token Supabase + rol
router.use(requireSupabaseAuth);
router.use(requireSupabaseRole(["Administrador"]));

router.get("/usuarios", async (_req, res) => {
  try {
    await ensureUserLastAccessColumn();
    const result = await pool.query(
      `SELECT
         u.usuario_id AS id,
         u.correo AS email,
         u.nombre_completo AS nombre,
         u.estado,
         r.nombre AS rol,
         u.fecha_creacion AS "fechaRegistro",
         GREATEST(u.ultimo_acceso, au.last_sign_in_at) AS "ultimoAcceso"
       FROM usuarios u
       LEFT JOIN usuarios_roles ur ON ur.usuario_id = u.usuario_id
       LEFT JOIN roles r ON r.rol_id = ur.rol_id
       LEFT JOIN auth.users au ON au.id::text = u.entra_oid
       ORDER BY u.usuario_id ASC`
    );

    res.json(result.rows);
  } catch (err: any) {
    // Algunas instalaciones pueden impedir consultar el esquema auth. En ese
    // caso se conserva el seguimiento local de actividad de la plataforma.
    try {
      const fallback = await pool.query(
        `SELECT
           u.usuario_id AS id,
           u.correo AS email,
           u.nombre_completo AS nombre,
           u.estado,
           r.nombre AS rol,
           u.fecha_creacion AS "fechaRegistro",
           u.ultimo_acceso AS "ultimoAcceso"
         FROM usuarios u
         LEFT JOIN usuarios_roles ur ON ur.usuario_id = u.usuario_id
         LEFT JOIN roles r ON r.rol_id = ur.rol_id
         ORDER BY u.usuario_id ASC`
      );
      return res.json(fallback.rows);
    } catch (fallbackError) {
      console.error("Error listando usuarios:", err);
      console.error("Error listando usuarios (fallback):", fallbackError);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }
});

function normalizeRolInput(value: any): "Estudiante" | "Docente" | "Administrador" | null {
  if (!value) return null;
  const v = String(value).toLowerCase();
  if (v === "admin" || v === "administrador") return "Administrador";
  if (v === "docente") return "Docente";
  if (v === "estudiante") return "Estudiante";
  return null;
}

router.patch("/usuarios/:id", async (req, res) => {
  const usuarioId = Number(req.params.id);
  if (!Number.isFinite(usuarioId)) {
    return res.status(400).json({ error: "ID inválido" });
  }

  const { nombre, email, estado, rol } = req.body ?? {};
  const rolNormalized = normalizeRolInput(rol);

  if (estado && !["activo", "suspendido", "pendiente"].includes(String(estado))) {
    return res.status(400).json({ error: "Estado inválido" });
  }

  const fields: Array<string> = [];
  const values: Array<any> = [];

  if (typeof nombre === "string") {
    fields.push(`nombre_completo = $${values.length + 1}`);
    values.push(nombre);
  }

  if (typeof email === "string") {
    fields.push(`correo = $${values.length + 1}`);
    values.push(email);
  }

  if (typeof estado === "string") {
    fields.push(`estado = $${values.length + 1}`);
    values.push(estado);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (fields.length > 0) {
      values.push(usuarioId);
      const q = `UPDATE usuarios SET ${fields.join(", ")} WHERE usuario_id = $${values.length}`;
      await client.query(q, values);
    }

    if (rol && !rolNormalized) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Rol inválido" });
    }

    if (rolNormalized) {
      const rolRow = await client.query(
        "SELECT rol_id FROM roles WHERE nombre = $1 LIMIT 1",
        [rolNormalized]
      );

      const rolId = rolRow.rows?.[0]?.rol_id;
      if (!rolId) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Rol no existe" });
      }

      await client.query("DELETE FROM usuarios_roles WHERE usuario_id = $1", [usuarioId]);
      await client.query(
        "INSERT INTO usuarios_roles (usuario_id, rol_id) VALUES ($1, $2)",
        [usuarioId, rolId]
      );
    }

    await client.query("COMMIT");
    return res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error actualizando usuario:", err);
    return res.status(500).json({ error: "Error interno del servidor" });
  } finally {
    client.release();
  }
});

router.delete("/usuarios/:id", async (req, res) => {
  const usuarioId = Number(req.params.id);
  if (!Number.isFinite(usuarioId)) {
    return res.status(400).json({ error: "ID inválido" });
  }

  try {
    await pool.query("DELETE FROM usuarios WHERE usuario_id = $1", [usuarioId]);
    return res.json({ ok: true });
  } catch (err) {
    console.error("Error eliminando usuario:", err);
    return res.status(409).json({ error: "No se pudo eliminar el usuario" });
  }
});

router.get("/stats", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         COUNT(*)::int AS "totalUsuarios",
         COUNT(*) FILTER (WHERE r.nombre = 'Estudiante' AND u.estado = 'activo')::int AS "estudiantesActivos",
         COUNT(*) FILTER (WHERE r.nombre = 'Docente' AND u.estado = 'activo')::int AS "docentesActivos",
         COUNT(*) FILTER (WHERE r.nombre = 'Administrador')::int AS "administradores"
       FROM usuarios u
       LEFT JOIN usuarios_roles ur ON ur.usuario_id = u.usuario_id
       LEFT JOIN roles r ON r.rol_id = ur.rol_id`
    );

    res.json(result.rows[0] || {
      totalUsuarios: 0,
      estudiantesActivos: 0,
      docentesActivos: 0,
      administradores: 0,
    });
  } catch (err) {
    console.error("Error consultando stats admin:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;
