import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  const client = await pool.connect();
  
  try {
    // Insert ticket_categories if not exists
    await client.query(`
      INSERT INTO settings (id, key, value, updated_at)
      SELECT gen_random_uuid(), 'ticket_categories', '[]', NOW()
      WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'ticket_categories')
    `);
    console.log('✓ ticket_categories inserted (or already exists)');

    // Insert ticket_types if not exists
    await client.query(`
      INSERT INTO settings (id, key, value, updated_at)
      SELECT gen_random_uuid(), 'ticket_types', '[]', NOW()
      WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'ticket_types')
    `);
    console.log('✓ ticket_types inserted (or already exists)');

    // Insert ticket_locations if not exists
    await client.query(`
      INSERT INTO settings (id, key, value, updated_at)
      SELECT gen_random_uuid(), 'ticket_locations', '[]', NOW()
      WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'ticket_locations')
    `);
    console.log('✓ ticket_locations inserted (or already exists)');

    console.log('\n✅ All ticket settings created successfully!');
  } catch (error) {
    console.error('Error inserting settings:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
