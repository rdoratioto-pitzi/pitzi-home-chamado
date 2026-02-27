const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

(async () => {
  try {
    const sql = fs.readFileSync('migrations/0006_create_omie_integration.sql', 'utf8');
    await pool.query(sql);
    console.log('✅ Migration Omie aplicada com sucesso!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    await pool.end();
    process.exit(1);
  }
})();
