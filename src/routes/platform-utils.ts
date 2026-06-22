import { requireSupabaseAuth, requireSupabaseRole } from "../middleware/supabase-auth";

export type RoleName = "Estudiante" | "Docente" | "Administrador";

type NotificationInput = {
  userIds: number[];
  tipo: string;
  titulo: string;
  mensaje: string;
  urlAccion?: string | null;
  origenTipo?: string | null;
  origenId?: number | null;
  sendEmail?: boolean;
};

export function requireRole(roles: RoleName[]) {
  return [requireSupabaseAuth, requireSupabaseRole(roles)];
}

export function parseJsonConfig(value: unknown) {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, unknown>;

  try {
    return JSON.parse(String(value)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function formatDate(value: unknown) {
  if (!value) return null;

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toISOString().slice(0, 10);
}

export function formatDateTime(value: unknown) {
  if (!value) return "";

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toISOString();
}

export function safeFilename(name: string) {
  return name.replace(/[^\w.\-]+/g, "_");
}

export function requireProfile(req: any) {
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

export async function uploadToStorage(bucket: string, path: string, file: Express.Multer.File) {
  const { url, key } = getStorageConfig();
  const storagePath = encodeURIComponent(path).replace(/%2F/g, "/");
  const response = await fetch(`${url}/storage/v1/object/${bucket}/${storagePath}`, {
    method: "POST",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": file.mimetype || "application/octet-stream",
      "x-upsert": "true",
    },
    body: file.buffer,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`No se pudo subir archivo a Storage: ${text}`);
  }

  return `${url}/storage/v1/object/public/${bucket}/${path}`;
}

export function getFrontendUrl() {
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

function buildActionUrl(urlAccion?: string | null) {
  if (!urlAccion) return null;
  if (urlAccion.startsWith("http")) return urlAccion;

  const frontendUrl = getFrontendUrl();
  if (!frontendUrl) return null;

  return `${frontendUrl}${urlAccion.startsWith("/") ? "" : "/"}${urlAccion}`;
}

export async function sendNotificationEmail(to: string, subject: string, message: string, urlAccion?: string | null) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATIONS_EMAIL_FROM || process.env.RESEND_FROM || process.env.EMAIL_FROM;

  if (!apiKey || !from || !to) {
    return {
      sent: false,
      skipped: true,
      reason: "Correo no configurado o destinatario vacio.",
    };
  }

  const actionUrl = buildActionUrl(urlAccion);
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
      body: JSON.stringify({ from, to, subject, html }),
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

export async function notifyUsers(db: any, input: NotificationInput) {
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
      input.urlAccion ?? null,
      input.origenTipo ?? null,
      input.origenId ?? null,
    ]
  );

  if (input.sendEmail === false) return;

  const users = await db.query(
    "SELECT usuario_id, correo FROM usuarios WHERE usuario_id = ANY($1::int[])",
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
