import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const sql = `
ALTER TABLE prompts_library 
ADD COLUMN IF NOT EXISTS translated_content TEXT,
ADD COLUMN IF NOT EXISTS translated_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_prompts_translated 
ON prompts_library(translated_at) 
WHERE translated_content IS NOT NULL;
`;

try {
  await pool.query(sql);
  console.log('✅ Migration aplicada com sucesso!');
  await pool.end();
  process.exit(0);
} catch (error) {
  console.error('❌ Erro:', error.message);
  process.exit(1);
}
