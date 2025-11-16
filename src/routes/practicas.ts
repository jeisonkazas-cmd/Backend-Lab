// src/routes/practicas.ts
import { Router } from "express";
import { pool } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

/**
 * GET /api/practicas
 * Lista todas las prácticas.
 * Más adelante podemos filtrar por estado o rol.
 */
router.get("/practicas", requireAuth, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_practica, titulo, descripcion, estado,
              fecha_publicacion, fecha_cierre, configuracion_simulacion, rubrica_id
       FROM practicas
       ORDER BY fecha_publicacion DESC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Error listando prácticas:", err);
    res.status(500).json({ error: "Error interno al listar prácticas" });
  }
});

/**
 * GET /api/practicas/:id_practica
 * Detalle de una práctica.
 */
router.get("/practicas/:id_practica", requireAuth, async (req, res) => {
  try {
    const { id_practica } = req.params;

    const result = await pool.query(
      `SELECT id_practica, titulo, descripcion, estado,
              fecha_publicacion, fecha_cierre, configuracion_simulacion, rubrica_id
       FROM practicas
       WHERE id_practica = $1`,
      [id_practica]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Práctica no encontrada" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error obteniendo práctica:", err);
    res.status(500).json({ error: "Error interno al obtener práctica" });
  }
});

/**
 * POST /api/practicas
 * Crear práctica nueva (solo Docente o Administrador).
 * body: { titulo, descripcion, estado?, fecha_cierre?, configuracion_simulacion? }
 */
router.post(
  "/practicas",
  requireRole(["Docente", "Administrador"]),
  async (req, res) => {
    try {
      const { titulo, descripcion, estado, fecha_cierre, configuracion_simulacion } =
        req.body;

      if (!titulo) {
        return res.status(400).json({ error: "titulo es obligatorio" });
      }

      const creado_por_id = req.session.user!.id_msentra_id;

      const result = await pool.query(
        `INSERT INTO practicas 
         (titulo, descripcion, estado, fecha_cierre, configuracion_simulacion, creado_por_id)
         VALUES ($1, $2, COALESCE($3, 'borrador'), $4, $5, $6)
         RETURNING id_practica, titulo, descripcion, estado,
                   fecha_publicacion, fecha_cierre, configuracion_simulacion`,
        [
          titulo,
          descripcion ?? null,
          estado ?? null,
          fecha_cierre ?? null,
          configuracion_simulacion ?? null,
          creado_por_id,
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Error creando práctica:", err);
      res.status(500).json({ error: "Error interno al crear práctica" });
    }
  }
);

/**
 * PATCH /api/practicas/:id_practica
 * Actualizar datos básicos de la práctica (Docente/Admin).
 */
router.patch(
  "/practicas/:id_practica",
  requireRole(["Docente", "Administrador"]),
  async (req, res) => {
    try {
      const { id_practica } = req.params;
      const { titulo, descripcion, estado, fecha_cierre, configuracion_simulacion } =
        req.body;

      const result = await pool.query(
        `UPDATE practicas
         SET
           titulo = COALESCE($2, titulo),
           descripcion = COALESCE($3, descripcion),
           estado = COALESCE($4, estado),
           fecha_cierre = COALESCE($5, fecha_cierre),
           configuracion_simulacion = COALESCE($6, configuracion_simulacion)
         WHERE id_practica = $1
         RETURNING id_practica, titulo, descripcion, estado,
                   fecha_publicacion, fecha_cierre, configuracion_simulacion`,
        [
          id_practica,
          titulo ?? null,
          descripcion ?? null,
          estado ?? null,
          fecha_cierre ?? null,
          configuracion_simulacion ?? null,
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Práctica no encontrada" });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error("Error actualizando práctica:", err);
      res.status(500).json({ error: "Error interno al actualizar práctica" });
    }
  }
);

/**
 * POST /api/practicas/:id_practica/cerrar
 * Cambia estado de la práctica a 'cerrada'.
 */
router.post(
  "/practicas/:id_practica/cerrar",
  requireRole(["Docente", "Administrador"]),
  async (req, res) => {
    try {
      const { id_practica } = req.params;

      const result = await pool.query(
        `UPDATE practicas
         SET estado = 'cerrada'
         WHERE id_practica = $1
         RETURNING id_practica, titulo, estado`,
        [id_practica]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Práctica no encontrada" });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error("Error cerrando práctica:", err);
      res.status(500).json({ error: "Error interno al cerrar práctica" });
    }
  }
);

export default router;
