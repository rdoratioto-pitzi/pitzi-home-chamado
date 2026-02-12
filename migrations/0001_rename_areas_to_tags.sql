-- Migration: Rename task_areas to task_tags and task_area_members to task_tag_members
-- Created: 2026-02-11
-- Description: Renames tables to support the new "Tags" concept instead of "Areas"

-- Rename task_areas table to task_tags
ALTER TABLE IF EXISTS task_areas RENAME TO task_tags;

-- Rename task_area_members table to task_tag_members
ALTER TABLE IF EXISTS task_area_members RENAME TO task_tag_members;

-- Rename the area_id column in tasks table to tag_id
ALTER TABLE IF EXISTS tasks RENAME COLUMN area_id TO tag_id;

-- Update foreign key constraint name if it exists
-- Note: The actual foreign key name might vary, this is a generic approach
-- Drizzle ORM will handle constraint names automatically

-- Add comments to document the change
COMMENT ON TABLE task_tags IS 'Tags for organizing tasks and meetings (formerly: task_areas)';
COMMENT ON TABLE task_tag_members IS 'Members of task/meeting tags with access permissions (formerly: task_area_members)';

-- Ensure indexes are updated (PostgreSQL should handle this automatically when renaming)
-- But we'll verify the foreign key references are intact

-- Note: If there are any views or functions referencing the old table names,
-- they need to be updated manually after this migration

-- Verify the migration
-- SELECT tablename FROM pg_tables WHERE tablename IN ('task_tags', 'task_tag_members');
