
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { tenants, users } from "../shared/schema";
import { eq } from "drizzle-orm";
// import * as schema from "@shared/schema";

const { Pool } = pg;

async function main() {
  if (!process.env.DATABASE_URL) {
      console.error("DATABASE_URL must be set");
      return;
  }

  // Accept user ID as CLI argument or environment variable
  const userId = process.argv[2] || process.env.DEBUG_USER_ID;
  
  if (!userId) {
      console.error("User ID must be provided as argument or DEBUG_USER_ID env variable");
      console.error("Usage: npx ts-node scripts/fix_tenant_debug.ts <userId>");
      return;
  }

  const pool = new Pool({
      connectionString: process.env.DATABASE_URL
  });

  const db = drizzle(pool);

  console.log("Checking tenants...");
  const allTenants = await db.select().from(tenants);
  console.log(`Found ${allTenants.length} tenants.`);

  console.log(`\nChecking user ${userId}...`);
  const user = await db.select().from(users).where(eq(users.id, userId));
  
  if (user.length === 0) {
      console.log("User not found!");
      return;
  }

  console.log(`User found. TenantId: ${user[0].tenantId}`);
  
  let tenantId = user[0].tenantId;

  if (allTenants.length === 0) {
      console.log("\nNo tenants found. Creating default tenant...");
      const newTenant = await db.insert(tenants).values({
          name: "Renov BD",
          slug: "renov-bd",
          status: "active"
      }).returning();
      console.log("Created tenant:", newTenant[0]);
      tenantId = newTenant[0].id;
  } else if (!tenantId) {
      console.log(`\nUser has no tenant. Assigning first tenant ${allTenants[0].id}...`);
      tenantId = allTenants[0].id;
  }

  if (tenantId && tenantId !== user[0].tenantId) {
      await db.update(users).set({ tenantId: tenantId }).where(eq(users.id, userId));
      console.log(`User updated with tenantId: ${tenantId}`);
  } else {
      console.log("User already has correct tenantId or no change needed.");
  }
}

main().catch(console.error);
