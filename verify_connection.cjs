
require('dotenv').config();
const { Client } = require('pg');

async function testConnection() {
    const connectionString = process.env.DATABASE_URL;
    console.log(`Testando conexão com: ${connectionString.replace(/:[^:@]+@/, ':****@')}`); // hide password
    
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false } // Supabase usually requires SSL
    });

    try {
        await client.connect();
        console.log("✅ Conexão bem sucedida!");
        const res = await client.query('SELECT NOW(), current_database(), current_user');
        console.log("📅 Hora do servidor:", res.rows[0].now);
        console.log("🗄️ Database:", res.rows[0].current_database);
        console.log("👤 User:", res.rows[0].current_user);
        await client.end();
    } catch (err) {
        console.error("❌ Erro na conexão:", err.message);
        if (err.code) console.error("Code:", err.code);
    }
}

testConnection();
