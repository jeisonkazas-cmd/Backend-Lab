import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

// Soporta Vercel Postgres (POSTGRES_URL) o DATABASE_URL personalizado
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("POSTGRES_URL o DATABASE_URL no está definida");
}

export const pool = new Pool({
  connectionString,
  // Para Vercel Postgres, desabilitar SSL si es necesario
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});
