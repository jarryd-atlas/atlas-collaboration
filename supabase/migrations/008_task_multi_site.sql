-- Migration: Allow tasks to be associated with multiple sites
-- Creates a junction table `task_sites` for many-to-many relationship

-- 1. Create the junction table
CREATE TABLE IF NOT EXISTS task_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(task_id, site_id)
);

-- Index for efficient lookups
CREATE INDEX idx_task_sites_task_id ON task_sites(task_id);
CREATE INDEX idx_task_sites_site_id ON task_sites(site_id);

-- 2. Migrate existing site associations from tasks.site_id
INSERT INTO task_sites (task_id, site_id)
SELECT id, site_id FROM tasks WHERE site_id IS NOT NULL
ON CONFLICT (task_id, site_id) DO NOTHING;

-- Note: We keep tasks.site_id for backward compatibility.
-- It will serve as the "primary" site for simple queries.
-- The task_sites table is the source of truth for all site associations.
