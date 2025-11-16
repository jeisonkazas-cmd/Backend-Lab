// src/routes/user.ts
import { Router } from "express";
import { pool } from "../db";

const router = Router();

router.get("/me", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "No autenticado" });
  }

  const { id_msentra_id } = req.session.user;

  try {
    const result = await pool.query(
      "SELECT id_msentra_id, correo, nombre, rol_plataforma FROM usuarios WHERE id_msentra_id = $1",
      [id_msentra_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error consultando usuario:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;
