import { db } from "./db";
import { users, taskAreas, pricingDevices, pricingPriceHistory } from "@shared/schema";
import { eq, and } from "drizzle-orm";

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

  // Seed pricing devices for testing
  const testDevices = [
    {
      categoryId: "d7f3dcd8-ddf9-4750-b1f8-c20a5bc9d345", // iPhone
      categoryName: "iPhone",
      manufacturerName: "Apple",
      modelName: "iPhone 11",
      storage: 128,
      condition: "novo",
      specs: JSON.stringify({
        display: "6.1 polegadas Liquid Retina HD",
        processor: "A13 Bionic",
        ram: "4GB",
        camera: "12MP + 12MP dual",
        battery: "3110mAh",
        os: "iOS 13",
        releaseYear: 2019
      }),
      releaseDate: new Date("2019-09-20"),
      imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone11-black-select-2019?wid=940&hei=1112&fmt=png-alpha&.v=1566956144418",
    },
    {
      categoryId: "d686a25d-045d-4b8c-9d7c-35a21d29d31b", // Smartphone (Geral)
      categoryName: "Smartphone",
      manufacturerName: "Samsung",
      modelName: "Galaxy S25",
      storage: 128,
      condition: "novo",
      specs: JSON.stringify({
        display: "6.2 polegadas Dynamic AMOLED 2X",
        processor: "Snapdragon 8 Elite",
        ram: "12GB",
        camera: "50MP + 12MP + 10MP triple",
        battery: "4000mAh",
        os: "Android 15",
        releaseYear: 2025
      }),
      releaseDate: new Date("2025-01-22"),
      imageUrl: "https://images.samsung.com/is/image/samsung/p6pim/br/2501/gallery/br-galaxy-s25-sm-s931-sm-s931blbqzto-thumb-544390117",
    },
  ];

  for (const device of testDevices) {
    const existing = await db.select().from(pricingDevices).where(
      and(
        eq(pricingDevices.manufacturerName, device.manufacturerName),
        eq(pricingDevices.modelName, device.modelName),
        eq(pricingDevices.storage, device.storage)
      )
    );
    if (existing.length === 0) {
      console.log(`[seed] Creating pricing device: ${device.manufacturerName} ${device.modelName} ${device.storage}GB...`);
      const [created] = await db.insert(pricingDevices).values(device).returning();
      
      // Seed price history for the last 90 days
      const now = new Date();
      const basePrice = device.manufacturerName === "Apple" ? 3500 : 5500;
      for (let i = 90; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const variation = (Math.random() - 0.5) * 400; // +/- R$200
        const deflation = i * 3; // Price drops R$3/day on average (deflation)
        const avgPrice = basePrice - deflation + variation;
        await db.insert(pricingPriceHistory).values({
          deviceId: created.id,
          date: date,
          minPrice: (avgPrice - 150).toFixed(2),
          avgPrice: avgPrice.toFixed(2),
          maxPrice: (avgPrice + 200).toFixed(2),
          sampleCount: Math.floor(Math.random() * 50) + 10,
          source: "scraping",
        });
      }
      console.log(`[seed] Created price history for ${device.manufacturerName} ${device.modelName}`);
    } else {
      console.log(`[seed] Pricing device '${device.manufacturerName} ${device.modelName} ${device.storage}GB' already exists.`);
    }
  }

  console.log("[seed] Database seeding complete.");
}
