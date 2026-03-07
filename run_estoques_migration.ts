import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error("DATABASE_URL não definida no .env");
        process.exit(1);
    }

    const client = new Client({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("Conectando ao banco de dados...");
        await client.connect();
        console.log("Conexão estabelecida.");

        const sqlPath = path.join(__dirname, "migrations", "0007_create_estoques_tables.sql");
        const sql = fs.readFileSync(sqlPath, "utf8");
        
        console.log("Executando migração...");
        await client.query(sql);
        console.log("Migração aplicada com sucesso!");
        
        await client.end();
        console.log("Conexão encerrada.");
    } catch (err) {
        console.error("Erro ao executar migração:", err);
        process.exit(1);
    }
}

runMigration();