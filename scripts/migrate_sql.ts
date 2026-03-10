import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function migrate() {
    try {
        console.log("🔍 Buscando admin pelo email...");
        const adminResult = await db.execute(sql`SELECT id FROM users WHERE email = 'admin@renov.com.br' LIMIT 1`);
        const admin = adminResult.rows[0];

        if (!admin) {
            console.error("❌ Usuário admin@renov.com.br não encontrado.");
            process.exit(1);
        }

        const adminId = admin.id;
        console.log("✅ Admin UUID:", adminId);

        console.log("🔍 Migrando chamados...");
        const result = await db.execute(sql`
            UPDATE tickets 
            SET requester_id = ${adminId} 
            WHERE requester_id = 'admin'
            RETURNING id
        `);

        console.log(`✅ Sucesso: ${result.rows.length} chamados migrados.`);
        process.exit(0);
    } catch (error) {
        console.error("❌ Erro durante a migração:", error);
        process.exit(1);
    }
}

migrate();
