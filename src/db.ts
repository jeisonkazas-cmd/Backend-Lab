import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config();

// Soporta Vercel Postgres (POSTGRES_URL) o DATABASE_URL personalizado
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("POSTGRES_URL o DATABASE_URL no está definida");
}

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});
