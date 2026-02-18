-- Migration: Add visibility column to tasks table
-- Created: 2026-02-18
-- Purpose: Add visibility field for task privacy control (private/shared/public)

-- Add visibility column with default 'private'
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private';

-- Create index for faster queries on visibility
CREATE INDEX IF NOT EXISTS idx_tasks_visibility ON tasks(visibility);

-- Update existing tasks to have visibility based on context:
-- Tasks without tagId (not in any area) remain private
-- Tasks in areas will default to private (set by the default constraint)
UPDATE tasks SET visibility = 'private' WHERE visibility IS NULL;

-- Add comment explaining visibility values
COMMENT ON COLUMN tasks.visibility IS 'Task visibility: private (only creator/assignee), shared (area members), public (everyone)';