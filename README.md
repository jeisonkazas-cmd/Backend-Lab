# Backend (Express + TypeScript) — OIDC + PostgreSQL skeleton

This repository contains a minimal backend skeleton for the project: TypeScript + Express, PostgreSQL (docker-compose), and OIDC-based delegated authentication with Microsoft Entra ID (OpenID Connect Authorization Code Flow).

What was added:
- DB connection and initialization (`src/db.ts`) — creates `users` table.
- OIDC login and callback using `openid-client` (`src/auth/oidc.ts`).
- Session middleware and simple user routes (`src/routes/user.ts`).
- Example `.env.example` and dev scripts in `package.json`.

Quick setup (local development):

1. Copy `.env.example` to `.env` and fill values (especially OIDC_* and SESSION_SECRET).

2. Start PostgreSQL (the project contains a `docker-compose.yml` with a postgres service):

   # using PowerShell
   docker-compose up -d

3. Install dependencies:

   npm install

4. Start dev server (with automatic restart):

   npm run dev

5. Visit `http://localhost:3000/auth/login` to start the Microsoft Entra ID login flow (after configuring a proper App Registration).

Notes and next steps:
- This skeleton uses in-memory session store (express-session MemoryStore). For production use replace with a persistent store (Redis, database, etc.) and enable secure cookies + HTTPS.
- Ensure the OIDC app registration includes the redirect URI configured in `OIDC_REDIRECT_URI`.
- Add stronger role management and migrations (e.g., with a migration tool). The current init simply ensures the `users` table exists.
