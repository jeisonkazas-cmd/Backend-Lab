# Backend (Express + TypeScript)

Este repositorio contiene un backend mínimo con **TypeScript + Express** y **PostgreSQL**, con autenticación OIDC usando Microsoft Entra ID.

## Requisitos

- Docker y Docker Compose
- Node.js (v18+ recomendado)
- Credenciales OIDC y `SESSION_SECRET`

## Instalación y ejecución

1. Copia el archivo de ejemplo de variables de entorno

2. Levanta la base de datos con Docker Compose:

```bash
docker-compose up -d
```

3. Instala dependencias:

```bash
npm install
```

4. Ejecuta el servidor en modo desarrollo:

```bash
npm run dev
```

5. Accede a la aplicación en:

```
http://localhost:3000/auth/login
```
