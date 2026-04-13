-- Fix: Enable RLS on task_sites junction table
-- This table was created in 008_task_multi_site.sql without RLS,
-- flagged by Supabase security advisor.

ALTER TABLE task_sites ENABLE ROW LEVEL SECURITY;

-- Read: anyone who can read the tenant (via the parent task)
CREATE POLICY "task_sites_read"
  ON task_sites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_sites.task_id
        AND public.can_read_tenant(t.tenant_id)
    )
  );

-- Insert: internal users only
CREATE POLICY "task_sites_insert"
  ON task_sites FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_sites.task_id
        AND public.is_active()
    )
  );

-- Delete: internal users only
CREATE POLICY "task_sites_delete"
  ON task_sites FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_sites.task_id
        AND public.is_internal()
    )
  );
