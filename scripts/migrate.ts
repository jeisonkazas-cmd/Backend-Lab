/**
 * Script de migración para crear todas las tablas en la BD
 * Ejecutar: npx ts-node scripts/migrate.ts
 */

import { pool } from "../src/db";

const migrations = [
  // Tabla: usuarios
  `
    CREATE TABLE IF NOT EXISTS usuarios (
      usuario_id SERIAL PRIMARY KEY,
      entra_oid VARCHAR(100) UNIQUE NOT NULL,
      correo VARCHAR(255) UNIQUE NOT NULL,
      nombre_completo VARCHAR(255) NOT NULL,
      estado VARCHAR(20) DEFAULT 'activo',
      fecha_creacion TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_usuarios_entra_oid ON usuarios(entra_oid);
  `,

  // Tabla: roles
  `
    CREATE TABLE IF NOT EXISTS roles (
      rol_id SERIAL PRIMARY KEY,
      nombre VARCHAR(50) UNIQUE NOT NULL,
      descripcion VARCHAR(255)
    );
  `,

  // Tabla: usuarios_roles
  `
    CREATE TABLE IF NOT EXISTS usuarios_roles (
      usuario_id INT NOT NULL REFERENCES usuarios(usuario_id) ON DELETE CASCADE,
      rol_id INT NOT NULL REFERENCES roles(rol_id) ON DELETE CASCADE,
      fecha_asignacion TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (usuario_id, rol_id)
    );
  `,

  // Tabla: grupos
  `
    CREATE TABLE IF NOT EXISTS grupos (
      grupo_id SERIAL PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      descripcion TEXT,
      estado VARCHAR(20) DEFAULT 'activo',
      fecha_creacion TIMESTAMP DEFAULT NOW()
    );
  `,

  // Tabla: grupos_estudiantes
  `
    CREATE TABLE IF NOT EXISTS grupos_estudiantes (
      grupo_id INT NOT NULL REFERENCES grupos(grupo_id) ON DELETE CASCADE,
      usuario_id INT NOT NULL REFERENCES usuarios(usuario_id) ON DELETE CASCADE,
      fecha_inscripcion TIMESTAMP DEFAULT NOW(),
      estado VARCHAR(20) DEFAULT 'activo',
      PRIMARY KEY (grupo_id, usuario_id)
    );
  `,

  // Tabla: grupos_docentes
  `
    CREATE TABLE IF NOT EXISTS grupos_docentes (
      grupo_id INT NOT NULL REFERENCES grupos(grupo_id) ON DELETE CASCADE,
      usuario_id INT NOT NULL REFERENCES usuarios(usuario_id) ON DELETE CASCADE,
      fecha_asignacion TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (grupo_id, usuario_id)
    );
  `,

  // Tabla: practicas
  `
    CREATE TABLE IF NOT EXISTS practicas (
      practica_id SERIAL PRIMARY KEY,
      grupo_id INT NOT NULL REFERENCES grupos(grupo_id) ON DELETE CASCADE,
      titulo VARCHAR(255) NOT NULL,
      descripcion TEXT,
      objetivos TEXT,
      instrucciones TEXT,
      fecha_publicacion TIMESTAMP DEFAULT NOW(),
      fecha_entrega TIMESTAMP,
      estado VARCHAR(20) DEFAULT 'activa'
    );
    CREATE INDEX IF NOT EXISTS idx_practicas_grupo_id ON practicas(grupo_id);
  `,

  // Tabla: simulaciones
  `
    CREATE TABLE IF NOT EXISTS simulaciones (
      simulacion_id SERIAL PRIMARY KEY,
      practica_id INT NOT NULL REFERENCES practicas(practica_id) ON DELETE CASCADE,
      titulo VARCHAR(255) NOT NULL,
      descripcion TEXT,
      url_recurso VARCHAR(255),
      configuracion_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_simulaciones_practica_id ON simulaciones(practica_id);
  `,

  // Tabla: informes
  `
    CREATE TABLE IF NOT EXISTS informes (
      informe_id SERIAL PRIMARY KEY,
      practica_id INT NOT NULL REFERENCES practicas(practica_id) ON DELETE CASCADE,
      estudiante_id INT NOT NULL REFERENCES usuarios(usuario_id) ON DELETE CASCADE,
      archivo_url VARCHAR(255),
      archivo_nombre VARCHAR(255),
      observaciones_estudiante TEXT,
      estado VARCHAR(20) DEFAULT 'entregado',
      fecha_entrega TIMESTAMP DEFAULT NOW(),
      fecha_actualizacion TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_informes_practica_id ON informes(practica_id);
    CREATE INDEX IF NOT EXISTS idx_informes_estudiante_id ON informes(estudiante_id);
  `,

  // Tabla: retroalimentaciones
  `
    CREATE TABLE IF NOT EXISTS retroalimentaciones (
      retroalimentacion_id SERIAL PRIMARY KEY,
      informe_id INT NOT NULL REFERENCES informes(informe_id) ON DELETE CASCADE,
      docente_id INT NOT NULL REFERENCES usuarios(usuario_id) ON DELETE CASCADE,
      comentario TEXT,
      calificacion DECIMAL(5,2),
      fecha_retroalimentacion TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_retroalimentaciones_informe_id ON retroalimentaciones(informe_id);
  `,

  // Tabla: foros
  `
    CREATE TABLE IF NOT EXISTS foros (
      foro_id SERIAL PRIMARY KEY,
      practica_id INT UNIQUE NOT NULL REFERENCES practicas(practica_id) ON DELETE CASCADE,
      titulo VARCHAR(255),
      descripcion TEXT,
      estado VARCHAR(20) DEFAULT 'activo',
      fecha_creacion TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_foros_practica_id ON foros(practica_id);
  `,

  // Tabla: mensajes_foro
  `
    CREATE TABLE IF NOT EXISTS mensajes_foro (
      mensaje_id SERIAL PRIMARY KEY,
      foro_id INT NOT NULL REFERENCES foros(foro_id) ON DELETE CASCADE,
      autor_id INT NOT NULL REFERENCES usuarios(usuario_id) ON DELETE CASCADE,
      mensaje_padre_id INT REFERENCES mensajes_foro(mensaje_id) ON DELETE SET NULL,
      contenido TEXT NOT NULL,
      fecha_creacion TIMESTAMP DEFAULT NOW(),
      fecha_edicion TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_mensajes_foro_foro_id ON mensajes_foro(foro_id);
    CREATE INDEX IF NOT EXISTS idx_mensajes_foro_autor_id ON mensajes_foro(autor_id);
  `,

  // Tabla: notificaciones
  `
    CREATE TABLE IF NOT EXISTS notificaciones (
      notificacion_id SERIAL PRIMARY KEY,
      usuario_id INT NOT NULL REFERENCES usuarios(usuario_id) ON DELETE CASCADE,
      tipo VARCHAR(50),
      titulo VARCHAR(255),
      mensaje TEXT,
      leida BOOLEAN DEFAULT false,
      fecha_creacion TIMESTAMP DEFAULT NOW(),
      url_accion VARCHAR(255),
      origen_tipo VARCHAR(50),
      origen_id INT
    );
    CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_id ON notificaciones(usuario_id);
  `,
];

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    console.log("🚀 Iniciando migraciones de base de datos...\n");

    for (let i = 0; i < migrations.length; i++) {
      try {
        console.log(`⏳ Ejecutando migración ${i + 1}/${migrations.length}...`);
        await client.query(migrations[i]);
        console.log(`✅ Migración ${i + 1} completada\n`);
      } catch (err: any) {
        console.error(`Error en migración ${i + 1}:`, err.message);
        throw err;
      }
    }

    console.log("Todas las migraciones completadas exitosamente!");
    console.log("\nTablas creadas:");
    console.log("  • usuarios");
    console.log("  • roles");
    console.log("  • usuarios_roles");
    console.log("  • grupos");
    console.log("  • grupos_estudiantes");
    console.log("  • grupos_docentes");
    console.log("  • practicas");
    console.log("  • simulaciones");
    console.log("  • informes");
    console.log("  • retroalimentaciones");
    console.log("  • foros");
    console.log("  • mensajes_foro");
    console.log("  • notificaciones");

  } catch (err) {
    console.error("Error durante migraciones:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations();
}

export default runMigrations;
