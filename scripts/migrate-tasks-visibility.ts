/**
 * Script to add visibility column to tasks table
 * Run with: npx tsx scripts/migrate-tasks-visibility.ts
 */

import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function migrate() {
  try {
    if (!db) {
      console.error("[MIGRATION] Database not connected");
      process.exit(1);
    }

    console.log("[MIGRATION] Starting tasks visibility migration...");

    // Check if column exists
    const checkResult = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tasks' AND column_name = 'visibility'
    `);

    if (checkResult.rows.length > 0) {
      console.log("[MIGRATION] Column 'visibility' already exists, skipping...");
    } else {
      // Add visibility column
      await db.execute(sql`
        ALTER TABLE tasks 
        ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'
      `);
      console.log("[MIGRATION] Added 'visibility' column to tasks table");

      // Create index
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_tasks_visibility ON tasks(visibility)
      `);
      console.log("[MIGRATION] Created index on visibility column");
    }

    // Update any NULL values (safety check)
    await db.execute(sql`
      UPDATE tasks SET visibility = 'private' WHERE visibility IS NULL
    `);
    console.log("[MIGRATION] Updated NULL visibility values to 'private'");

    // Verify migration
    const countResult = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE visibility = 'private') as private_count,
        COUNT(*) FILTER (WHERE visibility = 'shared') as shared_count,
        COUNT(*) FILTER (WHERE visibility = 'public') as public_count
      FROM tasks
    `);

    console.log("[MIGRATION] Migration complete!");
    console.log("[MIGRATION] Tasks by visibility:", countResult.rows[0]);

    process.exit(0);
  } catch (error) {
    console.error("[MIGRATION] Error:", error);
    process.exit(1);
  }
}

migrate();