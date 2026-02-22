const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

(async () => {
  try {
    const sql = fs.readFileSync('add_translation_columns.sql', 'utf8');
    await pool.query(sql);
    console.log('✅ Migration aplicada com sucesso!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
})();
