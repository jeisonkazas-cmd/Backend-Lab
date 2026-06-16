import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import cors from "cors";
import oidcRoutes from "./auth/oidc";
import userRoutes from "./routes/user";
import apiAuthRoutes from "./routes/api-auth";
import adminRoutes from "./routes/admin";
import practicasRoutes from "./routes/practicas";
import informesRoutes from "./routes/informes";
import foroRoutes from "./routes/foro";
import gruposRoutes from "./routes/grupos";
import platformRoutes from "./routes/platform";
import path from "path";
import { pool } from "./db";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";

dotenv.config();

const app = express();

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";
app.use(
  cors({
    // Nota: con credentials=true, no se puede usar "*" literal.
    // Si se configura "*", reflejamos el Origin del request.
    origin: corsOrigin === "*" ? true : corsOrigin,
    credentials: true,
  })
);

app.use(express.json());

// Servir archivos estáticos (PDFs, etc.)
app.use(
  "/uploads",
  express.static(path.join(__dirname, "..", "uploads"))
);

app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
  })
);

app.use("/auth", oidcRoutes);
app.use("/api/auth", apiAuthRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", practicasRoutes);
app.use("/api", informesRoutes);
app.use("/api/foro", foroRoutes);
app.use("/api/grupos", gruposRoutes);
app.use("/api/platform", platformRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/health/db", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  } catch (err) {
    console.error("DB health check failed:", err);
    const dbError = err as { code?: string };
    res.status(500).json({
      status: "error",
      error: "No se pudo conectar a la base de datos",
      code: dbError.code || null,
    });
  }
});

app.use(notFoundHandler);
app.use(errorHandler);




export default app;
