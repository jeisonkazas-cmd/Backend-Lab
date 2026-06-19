import { Router } from "express";
import multer from "multer";
import { pool } from "../db";
import { requireSupabaseAuth, requireSupabaseRole } from "../middleware/supabase-auth";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

type RoleName = "Estudiante" | "Docente" | "Administrador";

function requireRole(roles: RoleName[]) {
  return [requireSupabaseAuth, requireSupabaseRole(roles)];
}

function parseJsonConfig(value: unknown) {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, unknown>;
  try {
    return JSON.parse(String(value)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function formatDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
}

function formatDateTime(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString();
}

function safeFilename(name: string) {
  return name.replace(/[^\w.\-]+/g, "_");
}

async function ensureRecursosCatalogoTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS recursos_catalogo (
      recurso_id SERIAL PRIMARY KEY,
      titulo VARCHAR(255) NOT NULL,
      tipo VARCHAR(30) NOT NULL DEFAULT 'guia',
      laboratorio VARCHAR(80),
      archivo_url TEXT NOT NULL,
      archivo_nombre VARCHAR(255),
      storage_path TEXT,
      mime_type VARCHAR(120),
      estado VARCHAR(20) NOT NULL DEFAULT 'activo',
      creado_por INT REFERENCES usuarios(usuario_id) ON DELETE SET NULL,
      fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_recursos_catalogo_estado ON recursos_catalogo(estado);
    CREATE INDEX IF NOT EXISTS idx_recursos_catalogo_tipo ON recursos_catalogo(tipo);
  `);
}

async function ensureAcademicToolsTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rubricas (
      rubrica_id SERIAL PRIMARY KEY,
      docente_id INT NOT NULL REFERENCES usuarios(usuario_id) ON DELETE CASCADE,
      nombre VARCHAR(255) NOT NULL,
      descripcion TEXT,
      estado VARCHAR(20) NOT NULL DEFAULT 'activa',
      fecha_creacion TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS rubrica_criterios (
      criterio_id SERIAL PRIMARY KEY,
      rubrica_id INT NOT NULL REFERENCES rubricas(rubrica_id) ON DELETE CASCADE,
      nombre VARCHAR(255) NOT NULL,
      peso DECIMAL(5,2) NOT NULL CHECK (peso > 0 AND peso <= 100),
      puntaje_maximo DECIMAL(5,2) NOT NULL DEFAULT 5 CHECK (puntaje_maximo > 0)
    );
    CREATE TABLE IF NOT EXISTS asistencia_practica (
      asistencia_id SERIAL PRIMARY KEY,
      practica_id INT NOT NULL REFERENCES practicas(practica_id) ON DELETE CASCADE,
      estudiante_id INT NOT NULL REFERENCES usuarios(usuario_id) ON DELETE CASCADE,
      docente_id INT NOT NULL REFERENCES usuarios(usuario_id) ON DELETE CASCADE,
      estado VARCHAR(20) NOT NULL CHECK (estado IN ('presente', 'ausente', 'tarde', 'justificada')),
      observacion TEXT,
      fecha_registro TIMESTAMP DEFAULT NOW(),
      UNIQUE (practica_id, estudiante_id)
    );
  `);
}

function getStorageConfig() {
  const url = process.env.SUPABASE_URL || process.env.POSTGRES_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.POSTGRES_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.POSTGRES_SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "Falta configurar Storage en el backend: agrega SUPABASE_SERVICE_ROLE_KEY o POSTGRES_SUPABASE_SERVICE_ROLE_KEY en Vercel."
    );
  }

  return {
    url: url.replace(/\/$/, ""),
    key,
  };
}

async function uploadToStorage(bucket: string, path: string, file: Express.Multer.File) {
  const { url, key } = getStorageConfig();
  const response = await fetch(
    `${url}/storage/v1/object/${bucket}/${encodeURIComponent(path).replace(/%2F/g, "/")}`,
    {
      method: "POST",
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "content-type": file.mimetype || "application/octet-stream",
        "x-upsert": "true",
      },
      body: file.buffer,
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`No se pudo subir archivo a Storage: ${text}`);
  }

  return `${url}/storage/v1/object/public/${bucket}/${path}`;
}

function requireProfile(req: any) {
  if (!req.supabaseProfile?.usuario_id) {
    throw new Error("No se encontro perfil autenticado.");
  }
  return req.supabaseProfile as {
    usuario_id: number;
    correo: string;
    nombre_completo: string;
    estado: string;
    rol: string | null;
  };
}

function getFrontendUrl() {
  const raw = process.env.FRONTEND_URL || process.env.APP_URL || process.env.CORS_ORIGIN || "";
  return raw.split(",")[0].trim().replace(/\/$/, "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendNotificationEmail(to: string, subject: string, message: string, urlAccion?: string | null) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATIONS_EMAIL_FROM || process.env.RESEND_FROM || process.env.EMAIL_FROM;
  if (!apiKey || !from || !to) {
    return {
      sent: false,
      skipped: true,
      reason: "Correo no configurado o destinatario vacio.",
    };
  }

  const frontendUrl = getFrontendUrl();
  const actionUrl = urlAccion && urlAccion.startsWith("http")
    ? urlAccion
    : urlAccion && frontendUrl
      ? `${frontendUrl}${urlAccion.startsWith("/") ? "" : "/"}${urlAccion}`
      : null;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
      <h2>${escapeHtml(subject)}</h2>
      <p>${escapeHtml(message)}</p>
      ${actionUrl ? `<p><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#1152d4;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none">Ver en la plataforma</a></p>` : ""}
    </div>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn("No se pudo enviar correo de notificacion:", text);
      return {
        sent: false,
        skipped: false,
        status: response.status,
        error: text,
      };
    }

    const data = await response.json().catch(() => null);
    return {
      sent: true,
      skipped: false,
      status: response.status,
      data,
    };
  } catch (err) {
    console.warn("Error enviando correo de notificacion:", err);
    return {
      sent: false,
      skipped: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function notifyUsers(
  db: any,
  input: {
    userIds: number[];
    tipo: string;
    titulo: string;
    mensaje: string;
    urlAccion?: string | null;
    origenTipo?: string | null;
    origenId?: number | null;
    sendEmail?: boolean;
  }
) {
  const userIds = [...new Set(input.userIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (userIds.length === 0) return;

  await db.query(
    `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, url_accion, origen_tipo, origen_id)
     SELECT user_id, $2, $3, $4, $5, $6, $7
     FROM unnest($1::int[]) AS user_id`,
    [
      userIds,
      input.tipo,
      input.titulo,
      input.mensaje,
      input.urlAccion || null,
      input.origenTipo || null,
      input.origenId || null,
    ]
  );

  if (input.sendEmail === false) return;

  const users = await db.query(
    `SELECT usuario_id, correo FROM usuarios WHERE usuario_id = ANY($1::int[])`,
    [userIds]
  );

  await Promise.all(
    users.rows.map((user: any) => sendNotificationEmail(
      user.correo,
      input.titulo,
      input.mensaje,
      input.urlAccion
    ))
  );
}

async function assertDocenteGrupo(docenteId: number, grupoId: number) {
  const { rowCount } = await pool.query(
    `SELECT 1 FROM grupos_docentes WHERE usuario_id = $1 AND grupo_id = $2 LIMIT 1`,
    [docenteId, grupoId]
  );

  if (!rowCount) {
    const error = new Error("No autorizado para este grupo.");
    (error as any).status = 403;
    throw error;
  }
}

async function assertEstudianteGrupo(estudianteId: number, grupoId: number) {
  const { rowCount } = await pool.query(
    `SELECT 1
     FROM grupos_estudiantes
     WHERE usuario_id = $1 AND grupo_id = $2 AND COALESCE(estado, 'activo') = 'activo'
     LIMIT 1`,
    [estudianteId, grupoId]
  );

  if (!rowCount) {
    const error = new Error("No autorizado para este grupo.");
    (error as any).status = 403;
    throw error;
  }
}

async function getPracticaGrupo(practicaId: number) {
  const result = await pool.query(
    `SELECT grupo_id FROM practicas WHERE practica_id = $1 LIMIT 1`,
    [practicaId]
  );

  if (!result.rows[0]) {
    const error = new Error("Practica no encontrada.");
    (error as any).status = 404;
    throw error;
  }

  return Number(result.rows[0].grupo_id);
}

function mapGrupo(row: any) {
  return {
    id: String(row.grupo_id),
    nombre: row.nombre || `Grupo ${row.grupo_id}`,
    codigo: `Grupo ${row.grupo_id}`,
    descripcion: row.descripcion || "",
    estado: row.estado || "activo",
    semestre: row.descripcion || "Periodo actual",
    semester: row.descripcion || "Periodo actual",
    estudiantes: Number(row.estudiantes || 0),
    practicasCreadas: Number(row.practicas_creadas || 0),
    activo: (row.estado || "activo") === "activo",
    docente: row.docente || "",
    horario: "",
    salon: "",
    icono: "science",
  };
}

function mapPractica(row: any, informe?: any, retro?: any) {
  const config = parseJsonConfig(row.configuracion_json);
  const guiaUrl = config.guiaUrl || config.informeUrl || config.plantillaUrl || null;
  const estado = retro?.calificacion !== undefined && retro?.calificacion !== null
    ? "calificado"
    : informe?.estado || "pendiente";

  return {
    id: String(row.practica_id),
    grupoId: String(row.grupo_id),
    titulo: row.titulo || "Practica",
    descripcion: row.descripcion || "",
    objetivos: row.objetivos || "",
    instrucciones: row.instrucciones || row.objetivos || row.descripcion || "",
    estado,
    fechaCreacion: formatDate(row.fecha_publicacion),
    fechaLimite: formatDate(row.fecha_entrega),
    fechaFin: formatDate(row.fecha_entrega),
    fechaEntrega: formatDate(row.fecha_entrega),
    fecha: formatDate(row.fecha_entrega),
    htmlUrl: row.url_recurso || (config.simuladorUrl as string) || null,
    simuladorUrl: row.url_recurso || "",
    informeUrl: guiaUrl,
    guiaUrl,
    guiaNombre: config.guiaNombre || "",
    informeEntregadoUrl: informe?.archivo_url || null,
    archivoNombre: informe?.archivo_nombre || null,
    informeId: informe?.informe_id ? String(informe.informe_id) : null,
    calificacion: retro?.calificacion ?? null,
    puntaje: retro?.calificacion ?? undefined,
    retroalimentacion: retro?.comentario || "",
    asistencia: row.asistencia_estado || null,
    observacionAsistencia: row.asistencia_observacion || "",
    tipo: row.url_recurso ? "virtual" : "presencial",
    informesRecibidos: Number(row.informes_recibidos || 0),
    estudiantesAsignados: [],
  };
}

async function getOrCreateForo(practicaId: number) {
  const existing = await pool.query(
    `SELECT foro_id, practica_id, titulo, descripcion, estado
     FROM foros
     WHERE practica_id = $1
     LIMIT 1`,
    [practicaId]
  );

  if (existing.rows[0]) return existing.rows[0];

  const practica = await pool.query(`SELECT titulo FROM practicas WHERE practica_id = $1`, [practicaId]);
  const created = await pool.query(
    `INSERT INTO foros (practica_id, titulo, descripcion, estado)
     VALUES ($1, $2, $3, 'activo')
     RETURNING foro_id, practica_id, titulo, descripcion, estado`,
    [
      practicaId,
      practica.rows[0]?.titulo ? `Foro - ${practica.rows[0].titulo}` : "Foro de practica",
      "Espacio de discusion de la practica",
    ]
  );

  return created.rows[0];
}

router.get("/profile", ...requireRole(["Estudiante", "Docente", "Administrador"]), (req, res) => {
  const profile = requireProfile(req);
  res.json({
    id: String(profile.usuario_id),
    nombre: profile.nombre_completo || "Usuario",
    correo: profile.correo || "",
    primerNombre: (profile.nombre_completo || "Usuario").split(" ")[0],
    rol: profile.rol,
    estado: profile.estado,
  });
});

router.get("/notificaciones", ...requireRole(["Estudiante", "Docente", "Administrador"]), async (req, res, next) => {
  try {
    const profile = requireProfile(req);
    const result = await pool.query(
      `SELECT notificacion_id, tipo, titulo, mensaje, leida, fecha_creacion, url_accion, origen_tipo, origen_id
       FROM notificaciones
       WHERE usuario_id = $1
       ORDER BY fecha_creacion DESC
       LIMIT 30`,
      [profile.usuario_id]
    );

    res.json(result.rows.map((row) => ({
      id: String(row.notificacion_id),
      tipo: row.tipo,
      titulo: row.titulo,
      mensaje: row.mensaje,
      leida: Boolean(row.leida),
      fechaCreacion: formatDateTime(row.fecha_creacion),
      urlAccion: row.url_accion,
      origenTipo: row.origen_tipo,
      origenId: row.origen_id ? String(row.origen_id) : null,
    })));
  } catch (err) {
    next(err);
  }
});

router.patch("/notificaciones/:notificacionId/leida", ...requireRole(["Estudiante", "Docente", "Administrador"]), async (req, res, next) => {
  try {
    const profile = requireProfile(req);
    const notificacionId = Number(req.params.notificacionId);
    await pool.query(
      `UPDATE notificaciones SET leida = true WHERE notificacion_id = $1 AND usuario_id = $2`,
      [notificacionId, profile.usuario_id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.patch("/notificaciones/leidas", ...requireRole(["Estudiante", "Docente", "Administrador"]), async (req, res, next) => {
  try {
    const profile = requireProfile(req);
    await pool.query(
      `UPDATE notificaciones SET leida = true WHERE usuario_id = $1 AND leida = false`,
      [profile.usuario_id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/notificaciones/test-email", ...requireRole(["Estudiante", "Docente", "Administrador"]), async (req, res, next) => {
  try {
    const profile = requireProfile(req);
    if (!process.env.RESEND_API_KEY || !(process.env.NOTIFICATIONS_EMAIL_FROM || process.env.RESEND_FROM || process.env.EMAIL_FROM)) {
      return res.status(400).json({
        error: "Correo no configurado. Agrega RESEND_API_KEY y NOTIFICATIONS_EMAIL_FROM en Vercel.",
      });
    }

    const result = await sendNotificationEmail(
      profile.correo,
      "Prueba de notificaciones por correo",
      "El envío de correos de la plataforma está configurado correctamente.",
      "/"
    );

    if (!result?.sent) {
      return res.status(502).json({
        ok: false,
        mensaje: `No se pudo enviar el correo de prueba a ${profile.correo}.`,
        detalle: result,
      });
    }

    res.json({ ok: true, mensaje: `Correo de prueba enviado a ${profile.correo}.`, detalle: result });
  } catch (err) {
    next(err);
  }
});

router.get("/notificaciones/email-status", ...requireRole(["Estudiante", "Docente", "Administrador"]), async (req, res, next) => {
  try {
    const profile = requireProfile(req);
    res.json({
      configured: Boolean(process.env.RESEND_API_KEY && (process.env.NOTIFICATIONS_EMAIL_FROM || process.env.RESEND_FROM || process.env.EMAIL_FROM)),
      hasApiKey: Boolean(process.env.RESEND_API_KEY),
      from: process.env.NOTIFICATIONS_EMAIL_FROM || process.env.RESEND_FROM || process.env.EMAIL_FROM || null,
      frontendUrl: getFrontendUrl() || null,
      testRecipient: profile.correo || null,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/docente/grupos", ...requireRole(["Docente", "Administrador"]), async (req, res, next) => {
  try {
    const profile = requireProfile(req);
    const result = await pool.query(
      `SELECT
         g.grupo_id,
         g.nombre,
         g.descripcion,
         g.estado,
         (
           SELECT COUNT(*)::int
           FROM grupos_estudiantes ge
           WHERE ge.grupo_id = g.grupo_id
         ) AS estudiantes,
         (
           SELECT COUNT(*)::int
           FROM practicas p
           WHERE p.grupo_id = g.grupo_id
         ) AS practicas_creadas
       FROM grupos g
       JOIN grupos_docentes gd ON gd.grupo_id = g.grupo_id
       WHERE gd.usuario_id = $1
       ORDER BY g.nombre ASC`,
      [profile.usuario_id]
    );

    res.json(result.rows.map(mapGrupo));
  } catch (err) {
    console.error("Error en GET /api/platform/docente/grupos:", err);
    next(err);
  }
});

router.post("/docente/grupos", ...requireRole(["Docente", "Administrador"]), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const profile = requireProfile(req);
    const nombre = String(req.body.nombre || "").trim();
    const descripcion = String(req.body.descripcion || "").trim();
    const correos = String(req.body.estudiantes || "")
      .split(/[\n,;]+/)
      .map((correo) => correo.trim().toLowerCase())
      .filter(Boolean);

    if (!nombre) return res.status(400).json({ error: "El nombre del grupo es obligatorio." });

    await client.query("BEGIN");
    const grupo = await client.query(
      `INSERT INTO grupos (nombre, descripcion, estado)
       VALUES ($1, $2, 'activo')
       RETURNING grupo_id`,
      [nombre, descripcion || null]
    );
    const grupoId = grupo.rows[0].grupo_id;

    await client.query(
      `INSERT INTO grupos_docentes (grupo_id, usuario_id) VALUES ($1, $2)`,
      [grupoId, profile.usuario_id]
    );

    const result = {
      grupoId,
      estudiantesAgregados: 0,
      estudiantesNoEncontrados: [] as string[],
    };

    if (correos.length > 0) {
      const usuarios = await client.query(
        `SELECT usuario_id, LOWER(correo) AS correo FROM usuarios WHERE LOWER(correo) = ANY($1::text[])`,
        [[...new Set(correos)]]
      );
      const byEmail = new Map(usuarios.rows.map((usuario) => [usuario.correo, usuario.usuario_id]));
      result.estudiantesNoEncontrados = [...new Set(correos)].filter((correo) => !byEmail.has(correo));
      const estudianteIds = [...byEmail.values()] as number[];

      for (const usuarioId of estudianteIds) {
        await client.query(
          `INSERT INTO grupos_estudiantes (grupo_id, usuario_id, estado)
           VALUES ($1, $2, 'activo')`,
          [grupoId, usuarioId]
        );
        result.estudiantesAgregados += 1;
      }

      await notifyUsers(client, {
        userIds: estudianteIds,
        tipo: "grupo_asignado",
        titulo: "Te asignaron a un grupo",
        mensaje: `Fuiste registrado en el grupo ${nombre}.`,
        urlAccion: `/estudiante/grupos/${grupoId}/practicas`,
        origenTipo: "grupo",
        origenId: grupoId,
      });
    }

    await client.query("COMMIT");
    res.status(201).json(result);
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

router.get("/docente/grupos/:grupoId", ...requireRole(["Docente", "Administrador"]), async (req, res, next) => {
  try {
    const profile = requireProfile(req);
    const grupoId = Number(req.params.grupoId);
    await assertDocenteGrupo(profile.usuario_id, grupoId);
    const result = await pool.query(
      `SELECT
         g.grupo_id,
         g.nombre,
         g.descripcion,
         g.estado,
         (
           SELECT COUNT(*)::int
           FROM grupos_estudiantes ge
           WHERE ge.grupo_id = g.grupo_id
         ) AS estudiantes,
         (
           SELECT COUNT(*)::int
           FROM practicas p
           WHERE p.grupo_id = g.grupo_id
         ) AS practicas_creadas
       FROM grupos g
       WHERE g.grupo_id = $1
       LIMIT 1`,
      [grupoId]
    );

    if (!result.rows[0]) return res.status(404).json({ error: "Grupo no encontrado." });
    res.json(mapGrupo(result.rows[0]));
  } catch (err) {
    next(err);
  }
});

router.post("/docente/grupos/:grupoId/estudiantes", ...requireRole(["Docente", "Administrador"]), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const profile = requireProfile(req);
    const grupoId = Number(req.params.grupoId);
    await assertDocenteGrupo(profile.usuario_id, grupoId);

    const correos = String(req.body.estudiantes || req.body.correos || "")
      .split(/[\n,;]+/)
      .map((correo) => correo.trim().toLowerCase())
      .filter(Boolean);

    if (correos.length === 0) {
      return res.status(400).json({ error: "Ingresa al menos un correo de estudiante." });
    }

    const uniqueEmails = [...new Set(correos)];
    const usuarios = await client.query(
      `SELECT u.usuario_id, LOWER(u.correo) AS correo
       FROM usuarios u
       JOIN usuarios_roles ur ON ur.usuario_id = u.usuario_id
       JOIN roles r ON r.rol_id = ur.rol_id
       WHERE LOWER(u.correo) = ANY($1::text[])
         AND r.nombre = 'Estudiante'`,
      [uniqueEmails]
    );

    const byEmail = new Map(usuarios.rows.map((usuario) => [usuario.correo, usuario.usuario_id]));
    const estudiantesNoEncontrados = uniqueEmails.filter((correo) => !byEmail.has(correo));
    let estudiantesAgregados = 0;
    let estudiantesExistentes = 0;
    const estudiantesNotificar: number[] = [];

    await client.query("BEGIN");
    for (const usuarioId of byEmail.values()) {
      const inserted = await client.query(
        `INSERT INTO grupos_estudiantes (grupo_id, usuario_id, estado)
         SELECT $1, $2, 'activo'
         WHERE NOT EXISTS (
           SELECT 1 FROM grupos_estudiantes WHERE grupo_id = $1 AND usuario_id = $2
         )`,
        [grupoId, usuarioId]
      );

      if ((inserted.rowCount || 0) > 0) {
        estudiantesAgregados += 1;
        estudiantesNotificar.push(Number(usuarioId));
      } else {
        estudiantesExistentes += 1;
        await client.query(
          `UPDATE grupos_estudiantes SET estado = 'activo' WHERE grupo_id = $1 AND usuario_id = $2`,
          [grupoId, usuarioId]
        );
        estudiantesNotificar.push(Number(usuarioId));
      }
    }

    const grupoInfo = await client.query(`SELECT nombre FROM grupos WHERE grupo_id = $1`, [grupoId]);
    await notifyUsers(client, {
      userIds: estudiantesNotificar,
      tipo: "grupo_asignado",
      titulo: "Te asignaron a un grupo",
      mensaje: `Fuiste registrado en el grupo ${grupoInfo.rows[0]?.nombre || `Grupo ${grupoId}`}.`,
      urlAccion: `/estudiante/grupos/${grupoId}/practicas`,
      origenTipo: "grupo",
      origenId: grupoId,
    });
    await client.query("COMMIT");

    res.status(201).json({
      estudiantesAgregados,
      estudiantesExistentes,
      estudiantesNoEncontrados,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

router.get("/docente/grupos/:grupoId/practicas", ...requireRole(["Docente", "Administrador"]), async (req, res, next) => {
  try {
    const profile = requireProfile(req);
    const grupoId = Number(req.params.grupoId);
    await assertDocenteGrupo(profile.usuario_id, grupoId);
    const result = await pool.query(
      `SELECT
         p.*,
         (
           SELECT s.url_recurso
           FROM simulaciones s
           WHERE s.practica_id = p.practica_id
           ORDER BY s.simulacion_id ASC
           LIMIT 1
         ) AS url_recurso,
         (
           SELECT s.configuracion_json::text
           FROM simulaciones s
           WHERE s.practica_id = p.practica_id
           ORDER BY s.simulacion_id ASC
           LIMIT 1
         ) AS configuracion_json,
         (
           SELECT COUNT(*)::int
           FROM informes i
           WHERE i.practica_id = p.practica_id
         ) AS informes_recibidos
       FROM practicas p
       WHERE p.grupo_id = $1
       ORDER BY p.fecha_publicacion DESC`,
      [grupoId]
    );

    res.json(result.rows.map((row) => mapPractica(row)));
  } catch (err) {
    console.error("Error en GET /api/platform/docente/grupos/:grupoId/practicas:", err);
    next(err);
  }
});

router.post("/docente/guias", ...requireRole(["Docente", "Administrador"]), upload.single("file"), async (req, res, next) => {
  try {
    const profile = requireProfile(req);
    if (!req.file) return res.status(400).json({ error: "No se recibio archivo." });
    const allowedInformeTypes = new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]);
    if (!allowedInformeTypes.has(req.file.mimetype)) {
      return res.status(400).json({ error: "Solo se permiten archivos PDF o Word." });
    }

    const path = `${profile.usuario_id}/guias/${Date.now()}_${safeFilename(req.file.originalname)}`;
    const url = await uploadToStorage("recursos_catalogo", path, req.file);
    res.status(201).json({ url, nombre: req.file.originalname });
  } catch (err) {
    next(err);
  }
});

router.post("/docente/grupos/:grupoId/practicas", ...requireRole(["Docente", "Administrador"]), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const profile = requireProfile(req);
    const grupoId = Number(req.params.grupoId);
    await assertDocenteGrupo(profile.usuario_id, grupoId);

    const titulo = String(req.body.titulo || "").trim();
    if (!titulo) return res.status(400).json({ error: "El titulo es obligatorio." });

    await client.query("BEGIN");
    const practica = await client.query(
      `INSERT INTO practicas
       (grupo_id, titulo, descripcion, objetivos, instrucciones, fecha_entrega, estado)
       VALUES ($1, $2, $3, $4, $5, $6, 'activa')
       RETURNING practica_id`,
      [
        grupoId,
        titulo,
        req.body.descripcion || null,
        req.body.objetivos || null,
        req.body.instrucciones || null,
        req.body.fecha_entrega || null,
      ]
    );
    const practicaId = practica.rows[0].practica_id;

    if (req.body.simuladorUrl || req.body.guiaUrl) {
      await client.query(
        `INSERT INTO simulaciones
         (practica_id, titulo, descripcion, url_recurso, configuracion_json)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          practicaId,
          req.body.simulacionTitulo || titulo,
          req.body.simulacionDescripcion || null,
          req.body.simuladorUrl || null,
          JSON.stringify({
            guiaUrl: req.body.guiaUrl || null,
            guiaNombre: req.body.guiaNombre || null,
          }),
        ]
      );
    }

    const estudiantes = await client.query(
      `SELECT usuario_id FROM grupos_estudiantes WHERE grupo_id = $1 AND COALESCE(estado, 'activo') = 'activo'`,
      [grupoId]
    );
    await notifyUsers(client, {
      userIds: estudiantes.rows.map((row) => Number(row.usuario_id)),
      tipo: "practica_creada",
      titulo: "Nueva práctica disponible",
      mensaje: `El docente publicó la práctica ${titulo}.`,
      urlAccion: `/estudiante/practicas/${practicaId}`,
      origenTipo: "practica",
      origenId: practicaId,
    });

    await client.query("COMMIT");
    res.status(201).json({ practica_id: practicaId });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

router.get("/docente/practicas/:practicaId/informes", ...requireRole(["Docente", "Administrador"]), async (req, res, next) => {
  try {
    const profile = requireProfile(req);
    const practicaId = Number(req.params.practicaId);
    const grupoId = await getPracticaGrupo(practicaId);
    await assertDocenteGrupo(profile.usuario_id, grupoId);

    const result = await pool.query(
      `SELECT
         i.*,
         u.nombre_completo,
         u.correo,
         r.calificacion,
         r.comentario
       FROM informes i
       LEFT JOIN usuarios u ON u.usuario_id = i.estudiante_id
       LEFT JOIN retroalimentaciones r ON r.informe_id = i.informe_id
       WHERE i.practica_id = $1
       ORDER BY i.fecha_entrega DESC`,
      [practicaId]
    );

    res.json(result.rows.map((row) => ({
      id: String(row.informe_id),
      practicaId: String(row.practica_id),
      estudianteId: String(row.estudiante_id),
      estudianteNombre: row.nombre_completo || "Estudiante",
      estudianteEmail: row.correo || "",
      estado: row.calificacion !== null && row.calificacion !== undefined ? "calificado" : row.estado || "entregado",
      fechaEntrega: formatDate(row.fecha_entrega),
      nota: row.calificacion ?? null,
      feedback: row.comentario || "",
      archivoUrl: row.archivo_url || "",
      archivoNombre: row.archivo_nombre || "",
      observaciones: row.observaciones_estudiante || "",
      facultad: "Laboratorio de Fisica",
    })));
  } catch (err) {
    console.error("Error en GET /api/platform/docente/practicas/:practicaId/informes:", err);
    next(err);
  }
});

router.get("/docente/informes/:informeId", ...requireRole(["Docente", "Administrador"]), async (req, res, next) => {
  try {
    const informeId = Number(req.params.informeId);
    const informe = await pool.query(`SELECT practica_id FROM informes WHERE informe_id = $1`, [informeId]);
    if (!informe.rows[0]) return res.status(404).json({ error: "Informe no encontrado." });

    const informesResponse: any = { json: (value: unknown) => value };
    const result = await pool.query(
      `SELECT
         i.*,
         u.nombre_completo,
         u.correo,
         r.calificacion,
         r.comentario
       FROM informes i
       LEFT JOIN usuarios u ON u.usuario_id = i.estudiante_id
       LEFT JOIN retroalimentaciones r ON r.informe_id = i.informe_id
       WHERE i.informe_id = $1
       LIMIT 1`,
      [informeId]
    );

    const row = result.rows[0];
    void informesResponse;
    res.json({
      id: String(row.informe_id),
      practicaId: String(row.practica_id),
      estudianteId: String(row.estudiante_id),
      estudianteNombre: row.nombre_completo || "Estudiante",
      estudianteEmail: row.correo || "",
      estado: row.calificacion !== null && row.calificacion !== undefined ? "calificado" : row.estado || "entregado",
      fechaEntrega: formatDate(row.fecha_entrega),
      nota: row.calificacion ?? null,
      feedback: row.comentario || "",
      archivoUrl: row.archivo_url || "",
      archivoNombre: row.archivo_nombre || "",
      observaciones: row.observaciones_estudiante || "",
      facultad: "Laboratorio de Fisica",
    });
  } catch (err) {
    next(err);
  }
});

router.put("/docente/informes/:informeId/calificacion", ...requireRole(["Docente", "Administrador"]), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const profile = requireProfile(req);
    const informeId = Number(req.params.informeId);
    const nota = Number(req.body.nota);
    const comentario = String(req.body.comentario || "");

    if (Number.isNaN(nota) || nota < 0 || nota > 5) {
      return res.status(400).json({ error: "La nota debe estar entre 0 y 5." });
    }

    const informe = await client.query(
      `SELECT i.practica_id, i.estudiante_id, p.titulo
       FROM informes i
       JOIN practicas p ON p.practica_id = i.practica_id
       WHERE i.informe_id = $1`,
      [informeId]
    );
    if (!informe.rows[0]) return res.status(404).json({ error: "Informe no encontrado." });

    const grupoId = await getPracticaGrupo(Number(informe.rows[0].practica_id));
    await assertDocenteGrupo(profile.usuario_id, grupoId);

    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT retroalimentacion_id FROM retroalimentaciones WHERE informe_id = $1 LIMIT 1`,
      [informeId]
    );

    if (existing.rows[0]) {
      await client.query(
        `UPDATE retroalimentaciones
         SET docente_id = $2, calificacion = $3, comentario = $4, fecha_retroalimentacion = NOW()
         WHERE retroalimentacion_id = $1`,
        [existing.rows[0].retroalimentacion_id, profile.usuario_id, nota, comentario]
      );
    } else {
      await client.query(
        `INSERT INTO retroalimentaciones (informe_id, docente_id, calificacion, comentario)
         VALUES ($1, $2, $3, $4)`,
        [informeId, profile.usuario_id, nota, comentario]
      );
    }

    await client.query(
      `UPDATE informes SET estado = 'calificado', fecha_actualizacion = NOW() WHERE informe_id = $1`,
      [informeId]
    );
    await notifyUsers(client, {
      userIds: [Number(informe.rows[0].estudiante_id)],
      tipo: "informe_calificado",
      titulo: "Tu informe fue calificado",
      mensaje: `El docente calificó tu informe de ${informe.rows[0].titulo || "la práctica"}. Nota: ${nota}.`,
      urlAccion: `/estudiante/practicas/${informe.rows[0].practica_id}`,
      origenTipo: "informe",
      origenId: informeId,
    });
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

router.get("/estudiante/grupos", ...requireRole(["Estudiante", "Administrador"]), async (req, res, next) => {
  try {
    const profile = requireProfile(req);
    const result = await pool.query(
      `SELECT g.*, COALESCE(ge.estado, g.estado, 'activo') AS estado_link
       FROM grupos_estudiantes ge
       JOIN grupos g ON g.grupo_id = ge.grupo_id
       WHERE ge.usuario_id = $1
       ORDER BY g.nombre ASC`,
      [profile.usuario_id]
    );

    res.json(result.rows.map((row) => mapGrupo({ ...row, estado: row.estado_link })));
  } catch (err) {
    next(err);
  }
});

router.get("/estudiante/grupos/:grupoId", ...requireRole(["Estudiante", "Administrador"]), async (req, res, next) => {
  try {
    const profile = requireProfile(req);
    const grupoId = Number(req.params.grupoId);
    await assertEstudianteGrupo(profile.usuario_id, grupoId);
    const result = await pool.query(`SELECT * FROM grupos WHERE grupo_id = $1`, [grupoId]);
    if (!result.rows[0]) return res.status(404).json({ error: "Grupo no encontrado." });
    res.json(mapGrupo(result.rows[0]));
  } catch (err) {
    next(err);
  }
});

router.get("/estudiante/grupos/:grupoId/practicas", ...requireRole(["Estudiante", "Administrador"]), async (req, res, next) => {
  try {
    const profile = requireProfile(req);
    const grupoId = Number(req.params.grupoId);
    await assertEstudianteGrupo(profile.usuario_id, grupoId);
    const result = await pool.query(
      `SELECT p.*, s.url_recurso, s.configuracion_json, i.informe_id, i.archivo_url, i.archivo_nombre, i.estado AS informe_estado,
              r.calificacion, r.comentario
       FROM practicas p
       LEFT JOIN simulaciones s ON s.practica_id = p.practica_id
       LEFT JOIN informes i ON i.practica_id = p.practica_id AND i.estudiante_id = $2
       LEFT JOIN retroalimentaciones r ON r.informe_id = i.informe_id
       WHERE p.grupo_id = $1
       ORDER BY p.fecha_entrega ASC NULLS LAST`,
      [grupoId, profile.usuario_id]
    );

    res.json(result.rows.map((row) => mapPractica(row, {
      informe_id: row.informe_id,
      archivo_url: row.archivo_url,
      archivo_nombre: row.archivo_nombre,
      estado: row.informe_estado,
    }, {
      calificacion: row.calificacion,
      comentario: row.comentario,
    })));
  } catch (err) {
    next(err);
  }
});

router.get("/estudiante/practicas/:practicaId", ...requireRole(["Estudiante", "Administrador"]), async (req, res, next) => {
  try {
    await ensureAcademicToolsTables();
    const profile = requireProfile(req);
    const practicaId = Number(req.params.practicaId);
    const grupoId = await getPracticaGrupo(practicaId);
    await assertEstudianteGrupo(profile.usuario_id, grupoId);
    const result = await pool.query(
      `SELECT p.*, s.url_recurso, s.configuracion_json, i.informe_id, i.archivo_url, i.archivo_nombre, i.estado AS informe_estado,
              r.calificacion, r.comentario,
              a.estado AS asistencia_estado, a.observacion AS asistencia_observacion
       FROM practicas p
       LEFT JOIN simulaciones s ON s.practica_id = p.practica_id
       LEFT JOIN informes i ON i.practica_id = p.practica_id AND i.estudiante_id = $2
       LEFT JOIN retroalimentaciones r ON r.informe_id = i.informe_id
       LEFT JOIN asistencia_practica a ON a.practica_id = p.practica_id AND a.estudiante_id = $2
       WHERE p.practica_id = $1
       LIMIT 1`,
      [practicaId, profile.usuario_id]
    );

    if (!result.rows[0]) return res.status(404).json({ error: "Practica no encontrada." });
    const row = result.rows[0];
    res.json(mapPractica(row, {
      informe_id: row.informe_id,
      archivo_url: row.archivo_url,
      archivo_nombre: row.archivo_nombre,
      estado: row.informe_estado,
    }, {
      calificacion: row.calificacion,
      comentario: row.comentario,
    }));
  } catch (err) {
    next(err);
  }
});

router.post("/estudiante/practicas/:practicaId/informes", ...requireRole(["Estudiante", "Administrador"]), upload.single("file"), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const profile = requireProfile(req);
    const practicaId = Number(req.params.practicaId);
    const grupoId = await getPracticaGrupo(practicaId);
    await assertEstudianteGrupo(profile.usuario_id, grupoId);

    if (!req.file) return res.status(400).json({ error: "No se recibio archivo." });
    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ error: "Solo se permiten PDF." });
    }

    const path = `${profile.usuario_id}/${practicaId}/${Date.now()}_${safeFilename(req.file.originalname)}`;
    const archivoUrl = await uploadToStorage("informes", path, req.file);

    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT informe_id FROM informes WHERE practica_id = $1 AND estudiante_id = $2 LIMIT 1`,
      [practicaId, profile.usuario_id]
    );

    let informeId: number;
    if (existing.rows[0]) {
      const updated = await client.query(
        `UPDATE informes
         SET archivo_url = $2, archivo_nombre = $3, estado = 'entregado', fecha_actualizacion = NOW()
         WHERE informe_id = $1
         RETURNING informe_id`,
        [existing.rows[0].informe_id, archivoUrl, req.file.originalname]
      );
      informeId = Number(updated.rows[0].informe_id);
    } else {
      const inserted = await client.query(
        `INSERT INTO informes (practica_id, estudiante_id, archivo_url, archivo_nombre, estado)
         VALUES ($1, $2, $3, $4, 'entregado')
         RETURNING informe_id`,
        [practicaId, profile.usuario_id, archivoUrl, req.file.originalname]
      );
      informeId = Number(inserted.rows[0].informe_id);
    }

    const [practicaInfo, docentes] = await Promise.all([
      client.query(`SELECT titulo FROM practicas WHERE practica_id = $1`, [practicaId]),
      client.query(`SELECT usuario_id FROM grupos_docentes WHERE grupo_id = $1`, [grupoId]),
    ]);
    await notifyUsers(client, {
      userIds: docentes.rows.map((row) => Number(row.usuario_id)),
      tipo: "informe_subido",
      titulo: "Informe entregado",
      mensaje: `${profile.nombre_completo || "Un estudiante"} subió el informe de ${practicaInfo.rows[0]?.titulo || "la práctica"}.`,
      urlAccion: `/docente/grupo/${grupoId}/practica/${practicaId}/informe/${informeId}`,
      origenTipo: "informe",
      origenId: informeId,
    });

    await client.query("COMMIT");
    res.status(201).json({ success: true, mensaje: "Informe subido correctamente" });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

router.get("/practicas/:practicaId/foro", ...requireRole(["Estudiante", "Docente", "Administrador"]), async (req, res, next) => {
  try {
    const profile = requireProfile(req);
    const practicaId = Number(req.params.practicaId);
    const grupoId = await getPracticaGrupo(practicaId);
    if (profile.rol === "Docente") await assertDocenteGrupo(profile.usuario_id, grupoId);
    if (profile.rol === "Estudiante") await assertEstudianteGrupo(profile.usuario_id, grupoId);

    const foro = await getOrCreateForo(practicaId);
    const result = await pool.query(
      `SELECT m.*, u.nombre_completo, r.nombre AS rol
       FROM mensajes_foro m
       LEFT JOIN usuarios u ON u.usuario_id = m.autor_id
       LEFT JOIN usuarios_roles ur ON ur.usuario_id = u.usuario_id
       LEFT JOIN roles r ON r.rol_id = ur.rol_id
       WHERE m.foro_id = $1
       ORDER BY m.fecha_creacion ASC`,
      [foro.foro_id]
    );

    const mapMensaje = (row: any) => ({
      id: String(row.mensaje_id),
      autor: row.nombre_completo || "Usuario",
      autorNombre: row.nombre_completo || "Usuario",
      autorAvatar: null,
      rol: row.rol === "Docente" ? "profesor" : "estudiante",
      autorRol: row.rol === "Docente" ? "docente" : "estudiante",
      titulo: String(row.contenido || "").split("\n")[0].slice(0, 100) || "Publicación",
      contenido: row.contenido,
      preview: row.contenido,
      timestamp: formatDateTime(row.fecha_creacion),
      tiempoPublicacion: formatDateTime(row.fecha_creacion),
      visitas: 0,
      respuestas: 0,
      mensajePadreId: row.mensaje_padre_id ? String(row.mensaje_padre_id) : null,
      respuestasItems: [] as any[],
    });

    const mensajes = result.rows.map(mapMensaje);
    const mensajesPorId = new Map(mensajes.map((mensaje) => [mensaje.id, mensaje]));
    const hilos: any[] = [];

    for (const mensaje of mensajes) {
      if (mensaje.mensajePadreId && mensajesPorId.has(mensaje.mensajePadreId)) {
        const padre = mensajesPorId.get(mensaje.mensajePadreId);
        if (!padre) continue;
        padre.respuestasItems.push(mensaje);
        padre.respuestas = padre.respuestasItems.length;
      } else {
        hilos.push(mensaje);
      }
    }

    const countReplies = (mensaje: any): number => {
      mensaje.respuestas = mensaje.respuestasItems.reduce(
        (total: number, respuesta: any) => total + 1 + countReplies(respuesta),
        0
      );
      return mensaje.respuestas;
    };

    hilos.forEach(countReplies);
    res.json(hilos.reverse());
  } catch (err) {
    next(err);
  }
});

router.post("/practicas/:practicaId/foro", ...requireRole(["Estudiante", "Docente", "Administrador"]), async (req, res, next) => {
  try {
    const profile = requireProfile(req);
    const practicaId = Number(req.params.practicaId);
    const contenido = String(req.body.contenido || "").trim();
    const rawMensajePadreId = req.body.mensajePadreId
      ?? req.body.mensaje_padre_id
      ?? req.body.parentId
      ?? req.body.respondeA;
    const mensajePadreId = rawMensajePadreId !== undefined && rawMensajePadreId !== null && rawMensajePadreId !== ""
      ? Number(rawMensajePadreId)
      : null;
    if (!contenido) return res.status(400).json({ error: "El contenido es obligatorio." });
    if (mensajePadreId !== null && (!Number.isInteger(mensajePadreId) || mensajePadreId <= 0)) {
      return res.status(400).json({ error: "El mensaje a responder no es válido." });
    }

    const grupoId = await getPracticaGrupo(practicaId);
    if (profile.rol === "Docente") await assertDocenteGrupo(profile.usuario_id, grupoId);
    if (profile.rol === "Estudiante") await assertEstudianteGrupo(profile.usuario_id, grupoId);

    const foro = await getOrCreateForo(practicaId);
    if (mensajePadreId) {
      const parent = await pool.query(
        `SELECT mensaje_id FROM mensajes_foro WHERE mensaje_id = $1 AND foro_id = $2`,
        [mensajePadreId, foro.foro_id]
      );
      if (!parent.rows[0]) return res.status(400).json({ error: "El mensaje a responder no existe en este foro." });
    }

    const inserted = await pool.query(
      `INSERT INTO mensajes_foro (foro_id, autor_id, mensaje_padre_id, contenido)
       VALUES ($1, $2, $3, $4)
       RETURNING mensaje_id, mensaje_padre_id`,
      [foro.foro_id, profile.usuario_id, mensajePadreId, contenido]
    );

    const [practicaInfo, estudiantes, docentes] = await Promise.all([
      pool.query(`SELECT titulo FROM practicas WHERE practica_id = $1`, [practicaId]),
      pool.query(
        `SELECT usuario_id FROM grupos_estudiantes
         WHERE grupo_id = $1 AND usuario_id <> $2 AND COALESCE(estado, 'activo') = 'activo'`,
        [grupoId, profile.usuario_id]
      ),
      pool.query(
        `SELECT usuario_id FROM grupos_docentes WHERE grupo_id = $1 AND usuario_id <> $2`,
        [grupoId, profile.usuario_id]
      ),
    ]);
    const foroTitulo = practicaInfo.rows[0]?.titulo || "la práctica";
    const notificationTitle = mensajePadreId ? "Nueva respuesta en el foro" : "Nueva publicación en el foro";
    const notificationMessage = `${profile.nombre_completo || "Un usuario"} ${mensajePadreId ? "respondió" : "publicó"} en el foro de ${foroTitulo}.`;

    await Promise.all([
      notifyUsers(pool, {
        userIds: estudiantes.rows.map((row) => Number(row.usuario_id)),
        tipo: "foro",
        titulo: notificationTitle,
        mensaje: notificationMessage,
        urlAccion: `/estudiante/practicas/${practicaId}/foro/${grupoId}`,
        origenTipo: "foro",
        origenId: Number(inserted.rows[0].mensaje_id),
      }),
      notifyUsers(pool, {
        userIds: docentes.rows.map((row) => Number(row.usuario_id)),
        tipo: "foro",
        titulo: notificationTitle,
        mensaje: notificationMessage,
        urlAccion: `/docente/grupo/${grupoId}/practica/${practicaId}/foro`,
        origenTipo: "foro",
        origenId: Number(inserted.rows[0].mensaje_id),
      }),
    ]);

    res.status(201).json({
      success: true,
      mensaje: mensajePadreId ? "Respuesta publicada" : "Post publicado",
      id: String(inserted.rows[0].mensaje_id),
      mensajePadreId: inserted.rows[0].mensaje_padre_id ? String(inserted.rows[0].mensaje_padre_id) : null,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/admin/practicas", ...requireRole(["Administrador"]), async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT practica_id, titulo FROM practicas ORDER BY titulo ASC`
    );
    res.json(result.rows.map((row) => ({ id: row.practica_id, titulo: row.titulo })));
  } catch (err) {
    next(err);
  }
});

router.get("/admin/recursos", ...requireRole(["Administrador"]), async (_req, res, next) => {
  try {
    await ensureRecursosCatalogoTable();
    const result = await pool.query(
      `SELECT *
       FROM recursos_catalogo
       ORDER BY fecha_creacion DESC, recurso_id DESC`
    );

    res.json(result.rows.map((row) => ({
      id: String(row.recurso_id),
      sourceId: row.recurso_id,
      titulo: row.titulo,
      tipo: row.tipo,
      laboratorio: row.laboratorio || "",
      url: row.archivo_url,
      archivoNombre: row.archivo_nombre || "",
      mimeType: row.mime_type || "",
      fechaCreacion: row.fecha_creacion,
      descargas: 0,
      estado: row.estado || "activo",
    })));
  } catch (err) {
    next(err);
  }
});

router.get("/docente/recursos", ...requireRole(["Docente", "Administrador"]), async (_req, res, next) => {
  try {
    await ensureRecursosCatalogoTable();
    const result = await pool.query(
      `SELECT recurso_id, titulo, tipo, laboratorio, archivo_url, archivo_nombre
       FROM recursos_catalogo
       WHERE estado = 'activo'
       ORDER BY laboratorio ASC NULLS LAST, titulo ASC`
    );

    res.json(result.rows.map((row) => ({
      id: String(row.recurso_id),
      label: row.laboratorio ? `${row.laboratorio} - ${row.titulo}` : row.titulo,
      tipo: row.tipo,
      laboratorio: row.laboratorio || "",
      url: row.archivo_url,
      archivoNombre: row.archivo_nombre || "",
    })));
  } catch (err) {
    next(err);
  }
});

router.post("/admin/recursos", ...requireRole(["Administrador"]), upload.single("file"), async (req, res, next) => {
  try {
    const profile = requireProfile(req);
    const titulo = String(req.body.titulo || "").trim();
    const tipo = String(req.body.tipo || "guia").trim().toLowerCase();
    const laboratorio = String(req.body.laboratorio || "").trim();

    if (!titulo) return res.status(400).json({ error: "El titulo es obligatorio." });
    if (!["guia", "informe"].includes(tipo)) {
      return res.status(400).json({ error: "El tipo debe ser guia o informe." });
    }
    if (!req.file) return res.status(400).json({ error: "Selecciona un archivo." });

    const allowedTypes = new Set(["application/pdf", "text/html"]);
    const isHtmlByName = req.file.originalname.toLowerCase().endsWith(".html");
    if (!allowedTypes.has(req.file.mimetype) && !isHtmlByName) {
      return res.status(400).json({ error: "Solo se permiten archivos PDF o HTML." });
    }

    await ensureRecursosCatalogoTable();
    const path = `${tipo}s/${laboratorio || "general"}/${Date.now()}_${safeFilename(req.file.originalname)}`;
    const url = await uploadToStorage("recursos_catalogo", path, req.file);
    const created = await pool.query(
      `INSERT INTO recursos_catalogo
       (titulo, tipo, laboratorio, archivo_url, archivo_nombre, storage_path, mime_type, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING recurso_id`,
      [
        titulo,
        tipo,
        laboratorio || null,
        url,
        req.file.originalname,
        path,
        req.file.mimetype || (isHtmlByName ? "text/html" : "application/octet-stream"),
        profile.usuario_id,
      ]
    );

    res.status(201).json({ id: String(created.rows[0].recurso_id), url });
  } catch (err) {
    next(err);
  }
});

router.delete("/admin/recursos/:recursoId", ...requireRole(["Administrador"]), async (req, res, next) => {
  try {
    await ensureRecursosCatalogoTable();
    await pool.query(
      `UPDATE recursos_catalogo SET estado = 'inactivo' WHERE recurso_id = $1`,
      [Number(req.params.recursoId)]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get("/admin/contenido", ...requireRole(["Administrador"]), async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT
         s.simulacion_id,
         s.practica_id,
         s.titulo,
         s.url_recurso,
         s.configuracion_json,
         p.titulo AS practica_titulo,
         p.fecha_publicacion,
         p.estado
       FROM simulaciones s
       LEFT JOIN practicas p ON p.practica_id = s.practica_id
       ORDER BY s.simulacion_id DESC`
    );

    const rows: any[] = [];
    for (const row of result.rows) {
      const config = parseJsonConfig(row.configuracion_json);
      const fechaCreacion = row.fecha_publicacion || new Date().toISOString();

      if (row.url_recurso) {
        rows.push({
          id: `sim-${row.simulacion_id}`,
          sourceId: row.simulacion_id,
          practicaId: row.practica_id,
          titulo: row.titulo || row.practica_titulo || "Simulacion",
          tipo: "simulacion",
          url: row.url_recurso,
          fechaCreacion,
          descargas: 0,
          estado: row.estado || "activo",
        });
      }

      const guiaUrl = config.guiaUrl || config.informeUrl || config.plantillaUrl;
      if (guiaUrl) {
        rows.push({
          id: `guia-${row.simulacion_id}`,
          sourceId: row.simulacion_id,
          practicaId: row.practica_id,
          titulo: config.guiaNombre || config.informeNombre || `Guia - ${row.practica_titulo || row.titulo || "Practica"}`,
          tipo: "recurso",
          url: guiaUrl,
          fechaCreacion,
          descargas: 0,
          estado: row.estado || "activo",
        });
      }
    }

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/admin/contenido", ...requireRole(["Administrador"]), async (req, res, next) => {
  try {
    const practicaId = Number(req.body.practicaId);
    const titulo = String(req.body.titulo || "").trim();
    const tipo = String(req.body.tipo || "");
    const url = String(req.body.url || "").trim();

    if (!practicaId || !titulo || !url) {
      return res.status(400).json({ error: "Completa practica, titulo y URL." });
    }

    const existing = await pool.query(
      `SELECT simulacion_id, configuracion_json FROM simulaciones WHERE practica_id = $1 LIMIT 1`,
      [practicaId]
    );
    const target = existing.rows[0];

    if (tipo === "simulacion") {
      if (target) {
        await pool.query(
          `UPDATE simulaciones SET titulo = $2, url_recurso = $3 WHERE simulacion_id = $1`,
          [target.simulacion_id, titulo, url]
        );
      } else {
        await pool.query(
          `INSERT INTO simulaciones (practica_id, titulo, url_recurso, configuracion_json)
           VALUES ($1, $2, $3, '{}')`,
          [practicaId, titulo, url]
        );
      }
    } else {
      const config = parseJsonConfig(target?.configuracion_json);
      const nextConfig = { ...config, guiaUrl: url, guiaNombre: titulo };
      if (target) {
        await pool.query(
          `UPDATE simulaciones SET configuracion_json = $2 WHERE simulacion_id = $1`,
          [target.simulacion_id, JSON.stringify(nextConfig)]
        );
      } else {
        await pool.query(
          `INSERT INTO simulaciones (practica_id, titulo, url_recurso, configuracion_json)
           VALUES ($1, $2, NULL, $3)`,
          [practicaId, titulo, JSON.stringify(nextConfig)]
        );
      }
    }

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/admin/contenido/:tipo/:sourceId", ...requireRole(["Administrador"]), async (req, res, next) => {
  try {
    const sourceId = Number(req.params.sourceId);
    if (req.params.tipo === "simulacion") {
      await pool.query(`UPDATE simulaciones SET url_recurso = NULL WHERE simulacion_id = $1`, [sourceId]);
      return res.json({ ok: true });
    }

    const result = await pool.query(
      `SELECT configuracion_json FROM simulaciones WHERE simulacion_id = $1`,
      [sourceId]
    );
    const config = parseJsonConfig(result.rows[0]?.configuracion_json);
    delete config.guiaUrl;
    delete config.guiaNombre;
    delete config.informeUrl;
    delete config.informeNombre;
    delete config.plantillaUrl;

    await pool.query(
      `UPDATE simulaciones SET configuracion_json = $2 WHERE simulacion_id = $1`,
      [sourceId, JSON.stringify(config)]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get("/docente/rubricas", ...requireRole(["Docente", "Administrador"]), async (req, res, next) => {
  try {
    await ensureAcademicToolsTables();
    const profile = requireProfile(req);
    const result = await pool.query(
      `SELECT r.rubrica_id, r.nombre, r.descripcion, r.estado, r.fecha_creacion,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', rc.criterio_id,
                    'nombre', rc.nombre,
                    'peso', rc.peso,
                    'puntajeMaximo', rc.puntaje_maximo
                  ) ORDER BY rc.criterio_id
                ) FILTER (WHERE rc.criterio_id IS NOT NULL),
                '[]'::json
              ) AS criterios
       FROM rubricas r
       LEFT JOIN rubrica_criterios rc ON rc.rubrica_id = r.rubrica_id
       WHERE r.docente_id = $1
       GROUP BY r.rubrica_id
       ORDER BY r.fecha_creacion DESC`,
      [profile.usuario_id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post("/docente/rubricas", ...requireRole(["Docente", "Administrador"]), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await ensureAcademicToolsTables();
    const profile = requireProfile(req);
    const nombre = String(req.body.nombre || "").trim();
    const descripcion = String(req.body.descripcion || "").trim();
    const criterios = Array.isArray(req.body.criterios) ? req.body.criterios : [];
    if (!nombre) return res.status(400).json({ error: "El nombre de la rubrica es obligatorio." });
    if (criterios.length === 0) return res.status(400).json({ error: "Agrega al menos un criterio." });

    const normalized = criterios.map((criterio: any) => ({
      nombre: String(criterio.nombre || "").trim(),
      peso: Number(criterio.peso),
      puntajeMaximo: Number(criterio.puntajeMaximo || 5),
    }));
    if (normalized.some((criterio: any) => !criterio.nombre || !Number.isFinite(criterio.peso) || criterio.peso <= 0)) {
      return res.status(400).json({ error: "Cada criterio debe tener nombre y un peso mayor que cero." });
    }
    const totalPeso = normalized.reduce((sum: number, criterio: any) => sum + criterio.peso, 0);
    if (Math.abs(totalPeso - 100) > 0.01) {
      return res.status(400).json({ error: "La suma de los pesos debe ser 100%." });
    }

    await client.query("BEGIN");
    const rubric = await client.query(
      `INSERT INTO rubricas (docente_id, nombre, descripcion)
       VALUES ($1, $2, $3)
       RETURNING rubrica_id`,
      [profile.usuario_id, nombre, descripcion || null]
    );
    const rubricaId = rubric.rows[0].rubrica_id;
    for (const criterio of normalized) {
      await client.query(
        `INSERT INTO rubrica_criterios (rubrica_id, nombre, peso, puntaje_maximo)
         VALUES ($1, $2, $3, $4)`,
        [rubricaId, criterio.nombre, criterio.peso, criterio.puntajeMaximo]
      );
    }
    await client.query("COMMIT");
    res.status(201).json({ rubricaId });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

router.get("/docente/grupos/:grupoId/estudiantes", ...requireRole(["Docente", "Administrador"]), async (req, res, next) => {
  try {
    const profile = requireProfile(req);
    const grupoId = Number(req.params.grupoId);
    await assertDocenteGrupo(profile.usuario_id, grupoId);
    const result = await pool.query(
      `SELECT u.usuario_id, u.nombre_completo, u.correo
       FROM grupos_estudiantes ge
       JOIN usuarios u ON u.usuario_id = ge.usuario_id
       WHERE ge.grupo_id = $1 AND COALESCE(ge.estado, 'activo') = 'activo'
       ORDER BY u.nombre_completo ASC`,
      [grupoId]
    );
    res.json(result.rows.map((row) => ({
      id: String(row.usuario_id),
      nombre: row.nombre_completo,
      correo: row.correo,
    })));
  } catch (err) {
    next(err);
  }
});

router.get("/docente/practicas/:practicaId/asistencia", ...requireRole(["Docente", "Administrador"]), async (req, res, next) => {
  try {
    await ensureAcademicToolsTables();
    const profile = requireProfile(req);
    const practicaId = Number(req.params.practicaId);
    const grupoId = await getPracticaGrupo(practicaId);
    await assertDocenteGrupo(profile.usuario_id, grupoId);
    const result = await pool.query(
      `SELECT estudiante_id, estado, observacion, fecha_registro
       FROM asistencia_practica
       WHERE practica_id = $1`,
      [practicaId]
    );
    res.json(result.rows.map((row) => ({
      estudianteId: String(row.estudiante_id),
      estado: row.estado,
      observacion: row.observacion || "",
      fechaRegistro: row.fecha_registro,
    })));
  } catch (err) {
    next(err);
  }
});

router.put("/docente/practicas/:practicaId/asistencia", ...requireRole(["Docente", "Administrador"]), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await ensureAcademicToolsTables();
    const profile = requireProfile(req);
    const practicaId = Number(req.params.practicaId);
    const grupoId = await getPracticaGrupo(practicaId);
    await assertDocenteGrupo(profile.usuario_id, grupoId);
    const registros = Array.isArray(req.body.registros) ? req.body.registros : [];
    const allowed = new Set(["presente", "ausente", "tarde", "justificada"]);
    if (registros.length === 0) return res.status(400).json({ error: "No hay registros de asistencia." });

    await client.query("BEGIN");
    for (const registro of registros) {
      const estudianteId = Number(registro.estudianteId);
      const estado = String(registro.estado || "");
      if (!Number.isInteger(estudianteId) || !allowed.has(estado)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Registro de asistencia invalido." });
      }
      const membership = await client.query(
        `SELECT 1 FROM grupos_estudiantes
         WHERE grupo_id = $1 AND usuario_id = $2 AND COALESCE(estado, 'activo') = 'activo'`,
        [grupoId, estudianteId]
      );
      if (!membership.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "El estudiante no pertenece al grupo." });
      }
      await client.query(
        `INSERT INTO asistencia_practica
           (practica_id, estudiante_id, docente_id, estado, observacion, fecha_registro)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (practica_id, estudiante_id)
         DO UPDATE SET docente_id = EXCLUDED.docente_id,
                       estado = EXCLUDED.estado,
                       observacion = EXCLUDED.observacion,
                       fecha_registro = NOW()`,
        [practicaId, estudianteId, profile.usuario_id, estado, String(registro.observacion || "").trim() || null]
      );
    }
    await client.query("COMMIT");
    res.json({ ok: true, actualizados: registros.length });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

router.get("/admin/reportes", ...requireRole(["Administrador"]), async (_req, res, next) => {
  try {
    const [usuarios, informes, practicas] = await Promise.all([
      pool.query(
        `SELECT u.usuario_id, u.estado, r.nombre AS rol
         FROM usuarios u
         LEFT JOIN usuarios_roles ur ON ur.usuario_id = u.usuario_id
         LEFT JOIN roles r ON r.rol_id = ur.rol_id`
      ),
      pool.query(`SELECT informe_id, practica_id, estado, fecha_entrega FROM informes`),
      pool.query(`SELECT practica_id, titulo FROM practicas`),
    ]);

    const users = usuarios.rows;
    const reports = informes.rows;
    const resumen = {
      totalUsuarios: users.length,
      estudiantesActivos: users.filter((u) => u.rol === "Estudiante" && u.estado === "activo").length,
      docentesActivos: users.filter((u) => u.rol === "Docente" && u.estado === "activo").length,
      administradores: users.filter((u) => u.rol === "Administrador").length,
    };

    const roleItems = [
      { key: "Administrador", label: "Admin" },
      { key: "Docente", label: "Docente" },
      { key: "Estudiante", label: "Estudiante" },
    ];
    const totalUsuarios = Math.max(users.length, 1);
    const accesoPorRol = roleItems.map((item) => {
      const accesos = users.filter((u) => u.rol === item.key).length;
      return { rol: item.label, accesos, porcentaje: Math.round((accesos / totalUsuarios) * 100) };
    });

    const now = new Date();
    const actividadPorSemana = Array.from({ length: 7 }, (_, index) => {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (6 - index) * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);
      const accesos = reports.filter((informe) => {
        if (!informe.fecha_entrega) return false;
        const fecha = new Date(informe.fecha_entrega);
        return fecha >= weekStart && fecha < weekEnd;
      }).length;
      return { semana: `S${index + 1}`, accesos };
    });

    const practicaById = new Map(practicas.rows.map((row) => [row.practica_id, row.titulo]));
    const grouped = new Map<number, any>();
    for (const informe of reports) {
      const current = grouped.get(informe.practica_id) || {
        titulo: practicaById.get(informe.practica_id) || "Practica sin titulo",
        realizadas: 0,
        completadas: 0,
      };
      current.realizadas += 1;
      if (["calificado", "revisado", "aprobado"].includes(String(informe.estado || "").toLowerCase())) {
        current.completadas += 1;
      }
      grouped.set(informe.practica_id, current);
    }

    const practicasPopulares = Array.from(grouped.values())
      .map((practica) => ({
        ...practica,
        porcentaje: practica.realizadas ? Math.round((practica.completadas / practica.realizadas) * 100) : 0,
      }))
      .sort((a, b) => b.realizadas - a.realizadas)
      .slice(0, 8);

    const actividadTotal = actividadPorSemana.reduce((sum, item) => sum + item.accesos, 0);
    const semanaMasActiva = actividadPorSemana.reduce(
      (best, item) => (item.accesos > best.accesos ? item : best),
      actividadPorSemana[0] || { semana: "S1", accesos: 0 }
    );

    res.json({
      resumen,
      accesoPorRol,
      actividadPorSemana,
      practicasPopulares,
      estadisticasActividad: {
        semanaMasActiva,
        promedioSemanal: Math.round(actividadTotal / Math.max(actividadPorSemana.length, 1)),
        totalActividad: actividadTotal,
        ultimaActualizacion: new Date().toLocaleDateString("es-CO", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
