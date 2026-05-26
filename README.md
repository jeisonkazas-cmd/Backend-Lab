# Backend-Lab: Plataforma de Laboratorios Virtuales

Backend profesional en **TypeScript + Express** con arquitectura MVC, autenticación OIDC (Azure AD) y PostgreSQL.

## Características

- Arquitectura MVC: Controllers → Services → Repositories
- TypeScript: Tipado completo
- Autenticación OIDC: Microsoft Entra ID
- PostgreSQL: Base de datos con connection pooling
- Manejo de errores centralizado
- Validación por middleware
- Docker: docker-compose incluido
- Vercel-ready: Listo para producción

## Stack

- Backend: Express 5 + TypeScript 5
- Database: PostgreSQL 13+
- Auth: OpenID Connect (Azure AD)
- Session: Express Session
- Error Handling: Centralized middleware

## Inicio Rápido

### Requisitos

- Node.js 16+
- npm

### Instalación Local

1. **Clonar y navegar:**
```bash
cd Backend-Lab
```

2. **Instalar dependencias:**
```bash
npm install
```

3. **Configurar variables de entorno:**
```bash
cp .env.example .env
```

4. **Ejecutar en desarrollo:**
```bash
npm run dev
```

Servidor disponible en `http://localhost:3000`

### Scripts Disponibles

```bash
npm run dev          # Desarrollo
npm run build        # Compilar TypeScript
npm start            # Producción
npm run migrate      # Crear tablas en BD
npm run seed         # Insertar datos
npm run db:setup     # Build + migrate + seed
```

## API Endpoints

### Autenticación
```
GET  /auth/login              Login con Azure AD
GET  /auth/callback           Callback OIDC
POST /auth/logout             Logout
```

### Foro
```
GET    /api/foro/recientes           Posts recientes
GET    /api/foro/practica/:id        Posts de una práctica
GET    /api/foro/:postId             Obtener post
POST   /api/foro                     Crear post
PUT    /api/foro/:postId             Actualizar post
PATCH  /api/foro/:postId/respuesta   Registrar respuesta
```

### Grupos
```
GET    /api/grupos                   Todos los grupos
GET    /api/grupos/activos           Grupos activos
GET    /api/grupos/:grupoId          Detalle de grupo
GET    /api/grupos/docente/:docente  Grupos de docente
POST   /api/grupos                   Crear grupo
PUT    /api/grupos/:grupoId          Actualizar grupo
```

### Prácticas
```
GET    /api/practicas                Lista prácticas
GET    /api/practicas/:id            Detalle práctica
POST   /api/practicas                Crear práctica
POST   /api/practicas/upload-pdf     Subir PDF
PATCH  /api/practicas/:id            Actualizar
POST   /api/practicas/:id/cerrar     Cerrar práctica
```

## Estructura de Directorios

```
src/
├── controllers/          # Manejo de HTTP
│   ├── foro-controller.ts
│   ├── grupo-controller.ts
│   └── practica-controller.ts
├── services/            # Lógica de negocio
│   ├── foro-service.ts
│   ├── grupo-service.ts
│   └── practica-service.ts
├── repositories/        # Acceso a datos
│   ├── base-repository.ts
│   ├── foro-post-repository.ts
│   ├── grupo-repository.ts
│   └── practica-repository.ts
├── middleware/          # Express middlewares
│   ├── auth.ts
│   ├── validation.ts
│   └── error-handler.ts
├── routes/              # Definición de rutas
│   ├── foro.ts
│   ├── grupos.ts
│   ├── practicas.ts
│   ├── user.ts
│   └── informes.ts
├── utils/               # Utilidades
│   ├── errors.ts
│   └── async-handler.ts
├── app.ts               # Configuración Express
├── db.ts                # Pool PostgreSQL
└── server.ts            # Punto de entrada
```

## Deployment

### Vercel

```bash
npm install -g vercel
vercel --prod
```

## Configuración de Autenticación

### Azure AD

1. Registrar app en portal.azure.com
2. Obtener:
   - `AZURE_CLIENT_ID`
   - `AZURE_CLIENT_SECRET`
   - `AZURE_TENANT_ID`
3. Configurar redirect URI:
   - **Local**: `http://localhost:3000/auth/callback`
   - **Vercel**: `https://tu-proyecto.vercel.app/auth/callback`

4. Agregar variables a `.env`:
```env
AZURE_CLIENT_ID=xxx
AZURE_TENANT_ID=xxx
AZURE_CLIENT_SECRET=xxx
AZURE_REDIRECT_URI=http://localhost:3000/auth/callback
```

## Base de Datos

### Tablas Principales

**Backend-Lab (OIDC):**
- `usuarios` - Usuarios de Azure AD
- `cursos` - Cursos académicos
- `practicas` - Prácticas de laboratorio
- `informes` - Reportes de estudiantes

**Backend Local (Fusionado):**
- `grupos` - Grupos académicos
- `estudiantes_grupos` - Relación N:M
- `foro_posts` - Posts del foro

### Crear Tablas

```bash
# Con script automático
npm run migrate

# O manualmente en BD
npx ts-node scripts/migrate.ts
```

### Insertar Datos de Prueba

```bash
npm run seed
```

## 🔧 Variables de Entorno

Copiar `.env.example` a `.env`:

```bash
cp .env.example .env
```

Configurar:
```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5433/lab_fisica
POSTGRES_URL=postgresql://...  # Si usas Vercel Postgres

# Azure AD
AZURE_CLIENT_ID=xxx
AZURE_TENANT_ID=xxx
AZURE_CLIENT_SECRET=xxx
AZURE_REDIRECT_URI=http://localhost:3000/auth/callback

# Security
SESSION_SECRET=tu-secret-aqui

# Server
PORT=3000
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:5173
```

## 🧪 Testing

```bash
# Verificar tipos
npm run typecheck

# Build local (como Vercel)
npm run build

# Test endpoint salud
curl http://localhost:3000/api/health
```

## 📊 Monitoreo Post-Deploy

```bash
# Ver logs en Vercel
vercel logs tu-proyecto.vercel.app --follow

# Descargar variables (para debugging)
vercel env pull

# Health check
curl https://tu-proyecto.vercel.app/api/health
```

## 🐛 Troubleshooting

### "DATABASE_URL not defined"
```bash
vercel env pull
# Luego verificar .env.local
```

### "Connection refused"
```bash
# Verificar que PostgreSQL está corriendo
docker ps
docker-compose logs db
```

### "Cannot find module"
```bash
npm install
npm run build
npm start
```

### "Port already in use"
Vercel asigna puerto automáticamente. Localmente:
```bash
lsof -i :3000
kill -9 <PID>
```

## 📦 Dependencias Principales

```json
{
  "express": "^5.1.0",
  "typescript": "^5.6.2",
  "pg": "^8.11.0",
  "dotenv": "^16.3.1",
  "cors": "^2.8.5",
  "openid-client": "^5.2.0",
  "multer": "^2.0.2",
  "express-session": "^1.17.3"
}
```

## 🤝 Contribuciones

1. Crea rama: `git checkout -b feature/nueva-funcion`
2. Commit: `git commit -am "Agregar nueva función"`
3. Push: `git push origin feature/nueva-funcion`
4. Pull Request

## 📝 Notas

- Backend fusiona estructura MVC del backend local (JavaScript) con Backend-Lab (TypeScript)
- Sistema de errores centralizado para mejor debugging
- Pronto: Tests con Jest, Swagger docs, GraphQL

## 📞 Soporte

- **Vercel Docs**: https://vercel.com/docs
- **Express**: https://expressjs.com
- **PostgreSQL**: https://www.postgresql.org/docs
- **Azure AD**: https://learn.microsoft.com/en-us/azure/active-directory/

## 📄 Licencia

ISC

---

**Última actualización**: 26 de Mayo de 2026  
**Versión**: 1.0.0 (Con fusión MVC integrada)
