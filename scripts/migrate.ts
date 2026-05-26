/**
 * Script de migración para crear tablas en la BD
 * Ejecutar: npx ts-node scripts/migrate.ts
 * 
 * O en Vercel, ejecutar el SQL manualmente en la consola SQL
 */

import { pool } from "../src/db";

const migrations = [
  // Tabla: grupos
  `
    CREATE TABLE IF NOT EXISTS grupos (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      docente VARCHAR(100) NOT NULL,
      semester VARCHAR(20),
      horario VARCHAR(50),
      salon VARCHAR(50),
      activo BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_grupos_docente ON grupos(docente);
    CREATE INDEX IF NOT EXISTS idx_grupos_activo ON grupos(activo);
  `,

  // Tabla: estudiantes_grupos (relación N:M)
  `
    CREATE TABLE IF NOT EXISTS estudiantes_grupos (
      grupo_id INTEGER NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
      estudiante_id INTEGER NOT NULL,
      PRIMARY KEY (grupo_id, estudiante_id),
      created_at TIMESTAMP DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_estudiantes_grupos_grupo ON estudiantes_grupos(grupo_id);
  `,

  // Tabla: foro_posts
  `
    CREATE TABLE IF NOT EXISTS foro_posts (
      id SERIAL PRIMARY KEY,
      practica_id INTEGER NOT NULL,
      autor VARCHAR(100) NOT NULL,
      rol VARCHAR(20) DEFAULT 'estudiante',
      contenido TEXT NOT NULL,
      timestamp TIMESTAMP DEFAULT NOW(),
      visitas INTEGER DEFAULT 0,
      respuestas INTEGER DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_foro_posts_practica ON foro_posts(practica_id);
    CREATE INDEX IF NOT EXISTS idx_foro_posts_autor ON foro_posts(autor);
    CREATE INDEX IF NOT EXISTS idx_foro_posts_timestamp ON foro_posts(timestamp DESC);
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
        console.error(`❌ Error en migración ${i + 1}:`, err.message);
        throw err;
      }
    }

    console.log("✨ Todas las migraciones completadas exitosamente!");
    console.log("\n📋 Tablas creadas:");
    console.log("  • grupos");
    console.log("  • estudiantes_grupos");
    console.log("  • foro_posts");

  } catch (err) {
    console.error("❌ Error durante migraciones:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runMigrations();
}

export default runMigrations;
