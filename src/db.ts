import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config();

// Soporta varias formas de connection string según proveedor/integración.
// Orden (preferencia):
// - POSTGRES_URL / DATABASE_URL (estándar)
// - POSTGRES_SUPABASE_URL (integración Supabase/Vercel)
// - POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING (algunos templates)
const connectionString =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_SUPABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

if (!connectionString) {
  throw new Error(
    "No hay URL de Postgres configurada (POSTGRES_URL/DATABASE_URL/POSTGRES_SUPABASE_URL/POSTGRES_PRISMA_URL/POSTGRES_URL_NON_POOLING)"
  );
}

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});
