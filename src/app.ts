import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import oidcRoutes from "./auth/oidc";
import userRoutes from "./routes/user";
import practicasRoutes from "./routes/practicas";
import informesRoutes from "./routes/informes";

dotenv.config();

const app = express();

app.use(express.json());

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

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

export default app;
