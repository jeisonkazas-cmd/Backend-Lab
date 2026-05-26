import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import cors from "cors";
import oidcRoutes from "./auth/oidc";
import userRoutes from "./routes/user";
import practicasRoutes from "./routes/practicas";
import informesRoutes from "./routes/informes";
import foroRoutes from "./routes/foro";
import gruposRoutes from "./routes/grupos";
import path from "path";
import { pool } from "./db";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";

dotenv.config();

const app = express();

const corsOrigin = process.env.CORS_ORIGIN || "*";
app.use(
  cors({
    origin: corsOrigin,
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
app.use("/api/user", userRoutes);
app.use("/api", practicasRoutes);
app.use("/api", informesRoutes);
app.use("/api/foro", foroRoutes);
app.use("/api/grupos", gruposRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(notFoundHandler);
app.use(errorHandler);




export default app;
