import { pool } from "../server/db";

async function clearUpdates() {
  if (!pool) {
    console.log("❌ Pool de conexão não disponível");
    process.exit(1);
  }
  
  try {
    const result = await pool.query('DELETE FROM updates RETURNING id');
    console.log(`✅ ${result.rowCount} registros removidos da tabela updates`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao limpar tabela:", error);
    process.exit(1);
  }
}

clearUpdates();
