import { Router } from "express";
import { pool } from "../db";
import { requireRole } from "../middleware/auth";

const router = Router();

router.get("/me", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "No autenticado" });
  }

  const { id_msentra_id } = req.session.user;

  try {
    const result = await pool.query(
      "SELECT id_msentra_id, correo, nombre, rol_plataforma FROM usuarios WHERE id_msentra_id = $1",
      [id_msentra_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error consultando usuario:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// /mis-cursos
router.get(
  "/mis-cursos",
  requireRole(["Docente", "Administrador"]),
  async (req, res) => {
    try {
      const id_usuario = req.session.user!.id_msentra_id;

      const result = await pool.query(
        `SELECT id_curso, nombre, codigo, periodo
         FROM cursos
         WHERE creado_por_id = $1
         ORDER BY fecha_creacion ASC`,
        [id_usuario]
      );

      res.json(result.rows);
    } catch (err) {
      console.error("Error listando cursos del docente:", err);
      res.status(500).json({ error: "Error interno al listar cursos" });
    }
  }
);

export default router;
