import { pool } from "../src/db";

async function cleanDb() {
  const client = await pool.connect();
  try {
    console.log("Eliminando tablas viejas...");
    await client.query("DROP TABLE IF EXISTS foro_posts CASCADE;");
    await client.query("DROP TABLE IF EXISTS estudiantes_grupos CASCADE;");
    await client.query("DROP TABLE IF EXISTS grupos CASCADE;");
    console.log("Tablas viejas eliminadas");
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  cleanDb();
}

export default cleanDb;
