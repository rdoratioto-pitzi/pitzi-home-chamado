import { db } from "./server/db";
import { users, tickets } from "./shared/schema";
import { eq } from "drizzle-orm";

async function migrate() {
    try {
        const [admin] = await db.select().from(users).where(eq(users.username, "admin"));
        if (!admin) {
            console.error("❌ Usuário admin não encontrado.");
            process.exit(1);
        }

        console.log("✅ Admin UUID encontrado:", admin.id);

        const result = await db.update(tickets)
            .set({ requesterId: admin.id })
            .where(eq(tickets.requesterId, "admin"))
            .returning();

        console.log(`✅ Sucesso: ${result.length} chamados migrados de 'admin' para o UUID real.`);
        process.exit(0);
    } catch (error) {
        console.error("❌ Erro durante a migração:", error);
        process.exit(1);
    }
}

migrate();
