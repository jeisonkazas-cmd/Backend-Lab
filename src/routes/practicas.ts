import { Router } from "express";
import { pool } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import multer from "multer";
import path from "path";
import fs from "fs";
import { asyncHandler } from "../utils/async-handler";
import { practicaController } from "../controllers/practica-controller";
import { validateIdParam, validateBodyNotEmpty, validateRequiredFields } from "../middleware/validation";

// Carpeta donde se guardarán los PDFs
const uploadDir = path.join(__dirname, "..", "..", "uploads", "practicas");

// Asegurarse de que exista
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuración de multer
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${timestamp}_${safeName}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    // Solo PDFs
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Solo se permiten archivos PDF"));
    }
    cb(null, true);
  },
});


const router = Router();

/**
 * GET /api/practicas
 * Lista todas las prácticas (por ahora sin filtrar por rol).
 */
router.get("/practicas", requireAuth, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_practica, id_curso, titulo, descripcion, estado,
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
      `SELECT id_practica, id_curso, titulo, descripcion, estado,
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
 *
 * Aquí:
 *  1) busca un curso del docente
 *  2) si no hay, crea uno por defecto
 *  3) usa ese id_curso en el INSERT
 */
router.post(
  "/practicas",
  requireRole(["Docente", "Administrador"]),
  async (req, res) => {
    try {
      const {
        titulo,
        descripcion,
        estado,
        fecha_cierre,
        configuracion_simulacion,
      } = req.body;

      if (!titulo) {
        return res.status(400).json({ error: "titulo es obligatorio" });
      }

      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ error: "No autenticado" });
      }

      const creado_por_id = user.id_msentra_id;
      console.log("👨‍🏫 Creando práctica para usuario:", creado_por_id);

      // 1) Buscar un curso existente del docente
      let cursoResult = await pool.query(
        `
        SELECT id_curso, codigo, nombre
        FROM cursos
        WHERE creado_por_id = $1
        ORDER BY fecha_creacion ASC
        LIMIT 1
        `,
        [creado_por_id]
      );

      // 2) Si no existe, crear un curso "por defecto"
      if (cursoResult.rows.length === 0) {
        console.log("Creating default course...");

        const codigo = `LAB-FISICA-${Date.now()}`;
        const nombre = "Laboratorio de Física";
        const periodo = null;

        cursoResult = await pool.query(
          `
          INSERT INTO cursos (codigo, nombre, periodo, creado_por_id)
          VALUES ($1, $2, $3, $4)
          RETURNING id_curso, codigo, nombre
          `,
          [codigo, nombre, periodo, creado_por_id]
        );

        console.log("Course created:", cursoResult.rows[0]);
      } else {
        console.log("Using existing course:", cursoResult.rows[0]);
      }

      const id_curso = cursoResult.rows[0].id_curso;

      // 3) Insertar la práctica con id_curso
      console.log(" Insertando práctica con id_curso =", id_curso);

      const result = await pool.query(
        `INSERT INTO practicas 
         (id_curso, titulo, descripcion, estado, fecha_cierre, configuracion_simulacion, creado_por_id)
         VALUES ($1, $2, $3, COALESCE($4, 'borrador'), $5, $6, $7)
         RETURNING id_practica, id_curso, titulo, descripcion, estado,
                   fecha_publicacion, fecha_cierre, configuracion_simulacion`,
        [
          id_curso,
          titulo,
          descripcion ?? null,
          estado ?? null,
          fecha_cierre ?? null,
          configuracion_simulacion ?? null,
          creado_por_id,
        ]
      );

      console.log(" Práctica creada:", result.rows[0]);

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Error creando práctica:", err);
      res.status(500).json({ error: "Error interno al crear práctica" });
    }
  }
);

/**
 * POST /api/practicas/upload-pdf
 * Sube un PDF y devuelve la URL pública.
 * body: multipart/form-data con campo "file"
 */
router.post(
  "/practicas/upload-pdf",
  requireRole(["Docente", "Administrador", "Estudiante"]),
  upload.single("file"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No se recibió archivo" });
    }

    const relativePath = `/uploads/practicas/${req.file.filename}`;

    return res.status(201).json({
      message: "Archivo subido correctamente",
      url: relativePath,
      filename: req.file.originalname,
    });
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
      const {
        titulo,
        descripcion,
        estado,
        fecha_cierre,
        configuracion_simulacion,
      } = req.body;

      const result = await pool.query(
        `UPDATE practicas
         SET
           titulo = COALESCE($2, titulo),
           descripcion = COALESCE($3, descripcion),
           estado = COALESCE($4, estado),
           fecha_cierre = COALESCE($5, fecha_cierre),
           configuracion_simulacion = COALESCE($6, configuracion_simulacion)
         WHERE id_practica = $1
         RETURNING id_practica, id_curso, titulo, descripcion, estado,
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
