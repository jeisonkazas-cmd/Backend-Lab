import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import cors from "cors";
import oidcRoutes from "./auth/oidc";
import userRoutes from "./routes/user";
import practicasRoutes from "./routes/practicas";
import informesRoutes from "./routes/informes";
import path from "path";
import { pool } from "./db";   

dotenv.config();

const app = express();

// CORS primero
app.use(
  cors({
    origin: "http://localhost:5173", // frontend
    credentials: true,              // para permitir cookies
  })
);

app.use(express.json());

// Servir archivos estáticos (PDFs, etc.)
app.use(
  "/uploads",
  express.static(path.join(__dirname, "..", "uploads"))
);


// 🔐 Sesión
app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    // opcionalmente ajustar cookie:
    // cookie: {
    //   sameSite: "lax",
    // },
  })
);

//  Rutas
app.use("/auth", oidcRoutes);
app.use("/api/user", userRoutes);
app.use("/api", practicasRoutes);
app.use("/api", informesRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

/**
 *  1. Asegurar tabla SIMULACIONES
 */
async function ensureSimulacionesTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS simulaciones (
      id_simulacion   BIGSERIAL PRIMARY KEY,
      id_practica     BIGINT NOT NULL
                      REFERENCES practicas(id_practica)
                      ON DELETE CASCADE,
      id_usuario      VARCHAR(100) NOT NULL
                      REFERENCES usuarios(id_msentra_id)
                      ON DELETE CASCADE,
      intento         INT NOT NULL DEFAULT 1,
      parametros      JSONB,
      resultado       JSONB,
      fecha_ejecucion TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_simulaciones_practica_usuario
      ON simulaciones(id_practica, id_usuario);
  `;

  try {
    console.log("🛠️ Verificando/creando tabla SIMULACIONES...");
    await pool.query(sql);
    console.log(" Tabla SIMULACIONES lista");
  } catch (err) {
    console.error(" Error asegurando tabla SIMULACIONES:", err);
  }
}

/**
 *  2. Asegurar tabla INFORMES
 */
async function ensureInformesTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS informes (
      id_informe      BIGSERIAL PRIMARY KEY,
      id_practica     BIGINT NOT NULL
                      REFERENCES practicas(id_practica)
                      ON DELETE CASCADE,
      id_usuario      VARCHAR(100) NOT NULL
                      REFERENCES usuarios(id_msentra_id)
                      ON DELETE CASCADE,
      id_simulacion   BIGINT
                      REFERENCES simulaciones(id_simulacion)
                      ON DELETE SET NULL,
      titulo          VARCHAR(200),
      archivo_url     TEXT,
      contenido_texto TEXT,
      estado          VARCHAR(30) NOT NULL DEFAULT 'entregado'
                      CHECK (estado IN ('borrador','entregado','calificado')),
      fecha_entrega   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      nota            NUMERIC(5,2),
      retroalimentacion TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_informes_practica_usuario
      ON informes(id_practica, id_usuario);
  `;

  try {
    console.log(" Verificando/creando tabla INFORMES...");
    await pool.query(sql);
    console.log(" Tabla INFORMES lista");
  } catch (err) {
    console.error(" Error asegurando tabla INFORMES:", err);
  }
}

/**
 * 3. Ejecutar migraciones simples al arrancar
 */
(async () => {
  await ensureSimulacionesTable();
  await ensureInformesTable();
})();




export default app;
