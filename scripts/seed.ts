/**
 * Script para seed de datos de prueba
 * Ejecutar: npx ts-node scripts/seed.ts
 */

import { pool } from "../src/db";

async function seedDatabase() {
  const client = await pool.connect();

  try {
    console.log("🌱 Iniciando seed de datos...\n");

    // 1. Insertar grupos
    console.log("➕ Insertando grupos...");
    const gruposResult = await client.query(`
      INSERT INTO grupos (nombre, docente, semester, horario, salon, activo)
      VALUES 
        ('Física 101 - Grupo A', 'Dr. García', '2025-1', '10:00 AM', 'A-102', true),
        ('Física 101 - Grupo B', 'Dra. Martínez', '2025-1', '2:00 PM', 'A-103', true),
        ('Laboratorio Avanzado', 'Dr. López', '2025-1', '4:00 PM', 'B-205', true)
      RETURNING id, nombre;
    `);
    
    const grupos = gruposResult.rows;
    console.log(`✅ ${grupos.length} grupos insertados\n`);

    // 2. Insertar posts del foro
    console.log("➕ Insertando posts del foro...");
    const postsResult = await client.query(`
      INSERT INTO foro_posts (practica_id, autor, rol, contenido, visitas, respuestas)
      VALUES 
        (1, 'Juan Pérez', 'estudiante', '¿Alguien tiene dudas sobre el cálculo de la aceleración en el experimento?', 5, 2),
        (1, 'María González', 'estudiante', 'Yo tengo la misma duda, especialmente con las unidades', 3, 1),
        (1, 'Dr. García', 'docente', 'La aceleración se calcula como Δv/Δt. Revisen sus datos de velocidad.', 8, 0),
        (2, 'Carlos López', 'estudiante', '¿Cuál es la fecha límite para entregar el informe?', 12, 3),
        (2, 'Dra. Martínez', 'docente', 'La fecha límite es el viernes 31 de mayo a las 5 PM', 15, 0)
      RETURNING id, autor, contenido;
    `);
    
    const posts = postsResult.rows;
    console.log(`✅ ${posts.length} posts del foro insertados\n`);

    // 3. Insertar relaciones estudiantes-grupos
    console.log("➕ Asignando estudiantes a grupos...");
    await client.query(`
      INSERT INTO estudiantes_grupos (grupo_id, estudiante_id)
      VALUES 
        (${grupos[0].id}, 1), (${grupos[0].id}, 2), (${grupos[0].id}, 3),
        (${grupos[1].id}, 4), (${grupos[1].id}, 5),
        (${grupos[2].id}, 1), (${grupos[2].id}, 6)
      ON CONFLICT DO NOTHING;
    `);
    
    console.log(`✅ Estudiantes asignados a grupos\n`);

    console.log("✨ Seed completado exitosamente!");
    console.log("\n📊 Datos insertados:");
    console.log(`  • ${grupos.length} grupos`);
    console.log(`  • ${posts.length} posts del foro`);
    console.log(`  • 7 asignaciones estudiante-grupo`);

  } catch (err) {
    console.error("❌ Error durante seed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  seedDatabase();
}

export default seedDatabase;
