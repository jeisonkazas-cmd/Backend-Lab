// src/routes/informes.ts
import { Router } from "express";
import { pool } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

/**
 * POST /api/practicas/:id_practica/informes
 * Estudiante sube un informe para una práctica.
 * body: { titulo?, archivo_url?, contenido_texto? }
 */
router.post(
  "/practicas/:id_practica/informes",
  requireRole(["Estudiante"]),
  async (req, res) => {
    try {
      const { id_practica } = req.params;
      const { titulo, archivo_url, contenido_texto } = req.body;

      const id_usuario = req.session.user!.id_msentra_id;

      // Validación mínima
      if (!archivo_url && !contenido_texto) {
        return res.status(400).json({
          error: "Debes enviar al menos archivo_url o contenido_texto",
        });
      }

      const result = await pool.query(
        `INSERT INTO informes
         (id_practica, id_usuario, titulo, archivo_url, contenido_texto, estado)
         VALUES ($1, $2, $3, $4, $5, 'entregado')
         RETURNING id_informe, id_practica, id_usuario, titulo,
                   archivo_url, contenido_texto, estado, fecha_entrega, nota, retroalimentacion`,
        [
          id_practica,
          id_usuario,
          titulo ?? null,
          archivo_url ?? null,
          contenido_texto ?? null,
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Error subiendo informe:", err);
      res.status(500).json({ error: "Error interno al subir informe" });
    }
  }
);

/**
 * GET /api/mis-informes
 * Estudiante consulta todos sus informes.
 */
router.get("/mis-informes", requireRole(["Estudiante"]), async (req, res) => {
  try {
    const id_usuario = req.session.user!.id_msentra_id;

    const result = await pool.query(
      `SELECT i.id_informe, i.id_practica, p.titulo AS titulo_practica,
              i.titulo, i.estado, i.fecha_entrega, i.nota, i.retroalimentacion
       FROM informes i
       JOIN practicas p ON p.id_practica = i.id_practica
       WHERE i.id_usuario = $1
       ORDER BY i.fecha_entrega DESC`,
      [id_usuario]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Error listando informes del estudiante:", err);
    res.status(500).json({ error: "Error interno al listar informes" });
  }
});

/**
 * GET /api/practicas/:id_practica/informes
 * Docente/Admin consulta informes de una práctica.
 */
router.get(
  "/practicas/:id_practica/informes",
  requireRole(["Docente", "Administrador"]),
  async (req, res) => {
    try {
      const { id_practica } = req.params;

      const result = await pool.query(
        `SELECT i.id_informe, i.id_practica, i.id_usuario, u.nombre, u.correo,
                i.titulo, i.estado, i.fecha_entrega, i.nota, i.retroalimentacion
         FROM informes i
         JOIN usuarios u ON u.id_msentra_id = i.id_usuario
         WHERE i.id_practica = $1
         ORDER BY i.fecha_entrega DESC`,
        [id_practica]
      );

      res.json(result.rows);
    } catch (err) {
      console.error("Error listando informes de la práctica:", err);
      res.status(500).json({ error: "Error interno al listar informes" });
    }
  }
);

/**
 * PUT /api/informes/:id_informe/calificar
 * Docente/Admin califica un informe y deja retroalimentación.
 * body: { nota, retroalimentacion }
 */
router.put(
  "/informes/:id_informe/calificar",
  requireRole(["Docente", "Administrador"]),
  async (req, res) => {
    try {
      const { id_informe } = req.params;
      const { nota, retroalimentacion } = req.body;

      if (nota === undefined) {
        return res.status(400).json({ error: "nota es obligatoria" });
      }

      const result = await pool.query(
        `UPDATE informes
         SET nota = $2,
             retroalimentacion = COALESCE($3, retroalimentacion),
             estado = 'calificado'
         WHERE id_informe = $1
         RETURNING id_informe, id_practica, id_usuario, titulo,
                   estado, fecha_entrega, nota, retroalimentacion`,
        [id_informe, nota, retroalimentacion ?? null]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Informe no encontrado" });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error("Error calificando informe:", err);
      res.status(500).json({ error: "Error interno al calificar informe" });
    }
  }
);

export default router;
