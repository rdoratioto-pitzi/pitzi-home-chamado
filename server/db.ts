import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.warn("⚠️  DATABASE_URL not set.");
}

export const pool = process.env.DATABASE_URL
  ? new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Required for some Neon connections if cert is not provided
    }
  })
  : null;

export const db = pool ? drizzle(pool, { schema }) : null;
export type Database = NonNullable<typeof db>;

if (db) {
  console.log("✅ Database instance created.");
}
