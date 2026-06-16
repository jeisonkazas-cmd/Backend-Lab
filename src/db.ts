import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config();

function buildPostgresUrlFromParts(): string | null {
  const host = process.env.POSTGRES_HOST || process.env.POSTGRES_SUPABASE_HOST;
  const database =
    process.env.POSTGRES_DATABASE ||
    process.env.POSTGRES_DB ||
    process.env.POSTGRES_SUPABASE_DATABASE ||
    "postgres";
  const user = process.env.POSTGRES_USER || process.env.POSTGRES_SUPABASE_USER;
  const password =
    process.env.POSTGRES_PASSWORD || process.env.POSTGRES_SUPABASE_PASSWORD;
  const port = process.env.POSTGRES_PORT || process.env.POSTGRES_SUPABASE_PORT || "5432";

  if (!host || !user || !password) return null;

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

// POSTGRES_SUPABASE_URL is usually the HTTPS Supabase project URL, not a
// Postgres connection string. Keep it out of the database pool config.
const connectionString =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  buildPostgresUrlFromParts();

if (!connectionString) {
  throw new Error(
    "No hay conexion Postgres configurada (POSTGRES_URL/DATABASE_URL o POSTGRES_HOST+POSTGRES_USER+POSTGRES_PASSWORD)"
  );
}

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});
