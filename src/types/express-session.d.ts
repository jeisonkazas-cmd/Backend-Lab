import "express-session";

declare module "express-session" {
  interface SessionData {
    user?: {
      id_msentra_id: string;
      correo?: string;
      nombre?: string;
      rol_plataforma?: string;
    };
    codeVerifier?: string; // PKCE por sesión
  }
}
