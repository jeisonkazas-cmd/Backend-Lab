// src/auth/oidc.ts
import { Router } from "express";
import { Issuer, generators } from "openid-client";
import type { Client } from "openid-client";
import { pool } from "../db";

const router = Router();
let client: Client | null = null;

// Inicializar el cliente OIDC
(async () => {
  const issuer = await Issuer.discover(
    `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0`
  );

  client = new issuer.Client({
    client_id: process.env.AZURE_CLIENT_ID!,
    client_secret: process.env.AZURE_CLIENT_SECRET!,
    redirect_uris: [process.env.AZURE_REDIRECT_URI!],
    response_types: ["code"],
  });
})();

// LOGIN
router.get("/login", (req, res) => {
  if (!client) {
    return res.status(503).json({ error: "OIDC no inicializado" });
  }

  const codeVerifier = generators.codeVerifier();
  const codeChallenge = generators.codeChallenge(codeVerifier);

  // guardamos el verifier en la sesión de ESTE usuario
  req.session.codeVerifier = codeVerifier;

  const url = client.authorizationUrl({
    scope: "openid profile email",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  res.redirect(url);
});

// CALLBACK
router.get("/callback", async (req, res) => {
  if (!client) {
    return res.status(503).json({ error: "OIDC no inicializado" });
  }

  if (!req.session.codeVerifier) {
    return res.status(400).json({ error: "Falta codeVerifier en sesión" });
  }

  try {
    const params = client.callbackParams(req);

    const tokenSet = await client.callback(
      process.env.AZURE_REDIRECT_URI!,
      params,
      { code_verifier: req.session.codeVerifier }
    );

    const claims = tokenSet.claims();

    const sub = claims.sub as string;
    const email = (claims.email || claims.preferred_username) as
      | string
      | undefined;
    const name = (claims.name || claims.given_name) as string | undefined;

    // 1) Decidir el rol según el correo
    let rol: "Estudiante" | "Docente" | "Administrador" = "Estudiante";

    if (email?.startsWith("docente@")) {
      rol = "Docente";
    } else if (email?.startsWith("estudiante@")) {
      rol = "Estudiante";
    }
    // si mañana quieres un admin:
    // else if (email === "admin@...") rol = "Administrador";

    // 2) Crear / actualizar usuario en la BD
    // IMPORTANTE: en tu schema, id_msentra_id debe ser PK o UNIQUE
    await pool.query(
      `INSERT INTO usuarios (id_msentra_id, correo, nombre, rol_plataforma)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id_msentra_id) DO UPDATE
         SET correo = EXCLUDED.correo,
             nombre = EXCLUDED.nombre,
             rol_plataforma = EXCLUDED.rol_plataforma`,
      [sub, email ?? "", name ?? "", rol]
    );

    // 3) Leer el usuario ya “oficial” desde la BD
    const result = await pool.query(
      "SELECT id_msentra_id, correo, nombre, rol_plataforma FROM usuarios WHERE id_msentra_id = $1",
      [sub]
    );

    const user = result.rows[0];

    // 4) Guardar en sesión para el resto de la app
    req.session.user = {
      id_msentra_id: user.id_msentra_id,
      correo: user.correo,
      nombre: user.nombre,
      rol_plataforma: user.rol_plataforma,
    };

    // 5) Redirigir al frontend
    res.redirect("http://localhost:5173"); // ajusta la ruta que uses
  } catch (err) {
    console.error("Error en callback OIDC:", err);
    res.status(500).send("Error en autenticación");
  }
});

export default router;
