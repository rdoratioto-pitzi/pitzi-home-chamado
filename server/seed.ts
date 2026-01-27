import { db } from "./db";
import { users, taskAreas } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function seedDatabase() {
  console.log("[seed] Checking and seeding initial data...");

  // Seed admin user if not exists
  let adminId: string;
  const existingAdmin = await db.select().from(users).where(eq(users.email, "admin@renov.com.br"));
  if (existingAdmin.length === 0) {
    console.log("[seed] Creating admin user...");
    const [newAdmin] = await db.insert(users).values({
      name: "Administrador",
      email: "admin@renov.com.br",
      password: "admin123",
      status: "active",
      authMethod: "email",
      modulePermissions: JSON.stringify({
        chamados: true,
        projetos: true,
        tarefas: true,
        okrs: true,
        logistica: true,
        apis: true,
        configuracoes: true,
      }),
    }).returning();
    adminId = newAdmin.id;
    console.log("[seed] Admin user created with ID:", adminId);
  } else {
    adminId = existingAdmin[0].id;
    console.log("[seed] Admin user already exists with ID:", adminId);
  }

  // Seed default task areas by name (upsert pattern)
  const defaultAreas = [
    { name: "TI", color: "#3B82F6" },
    { name: "RH", color: "#EF4444" },
    { name: "Operações", color: "#F59E0B" },
  ];

  for (const area of defaultAreas) {
    const existingArea = await db.select().from(taskAreas).where(eq(taskAreas.name, area.name));
    if (existingArea.length === 0) {
      console.log(`[seed] Creating task area: ${area.name}...`);
      await db.insert(taskAreas).values({
        name: area.name,
        ownerId: adminId,
        visibility: "shared",
        color: area.color,
        icon: "folder",
      });
    } else {
      console.log(`[seed] Task area '${area.name}' already exists.`);
    }
  }

  console.log("[seed] Database seeding complete.");
}
