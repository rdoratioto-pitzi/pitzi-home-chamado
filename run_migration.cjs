const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

(async () => {
  try {
    const sql = fs.readFileSync('migrations/0011_add_pricing_scraped_data.sql', 'utf8');
    await pool.query(sql);
    console.log('✅ Migration aplicada com sucesso! (Pricing Scraped Data)');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
})();
