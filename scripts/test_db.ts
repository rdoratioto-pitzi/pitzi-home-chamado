import pg from "pg";
const { Client } = pg;

async function test() {
    const client = new Client({
        connectionString: "postgresql://neondb_owner:npg_eZ9RbfHkJ5tT@ep-morning-boat-ahh19k21.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"
    });

    try {
        console.log("Tentando conectar...");
        await client.connect();
        console.log("Conectado com sucesso!");
        const res = await client.query("SELECT NOW()");
        console.log("Resultado query:", res.rows[0]);
        await client.end();
    } catch (err) {
        console.error("Erro na conexão:", err);
    }
}

test();
