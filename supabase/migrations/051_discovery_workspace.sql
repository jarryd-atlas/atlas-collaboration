-- Discovery Workspace: Section status tracking for collaborative visibility
-- Each row tracks one assessment section's workflow status.

CREATE TYPE section_status AS ENUM ('not_started', 'in_progress', 'needs_review', 'complete');

CREATE TABLE section_statuses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   uuid NOT NULL REFERENCES site_assessments(id) ON DELETE CASCADE,
  site_id         uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  section_key     text NOT NULL,
  status          section_status NOT NULL DEFAULT 'not_started',
  assignee_id     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assessment_id, section_key)
);

CREATE INDEX section_statuses_site_idx ON section_statuses(site_id);
CREATE INDEX section_statuses_assignee_idx ON section_statuses(assignee_id);
CREATE INDEX section_statuses_assessment_idx ON section_statuses(assessment_id);

-- RLS policies
ALTER TABLE section_statuses ENABLE ROW LEVEL SECURITY;

-- Anyone in the tenant can read section statuses
CREATE POLICY section_statuses_select ON section_statuses
  FOR SELECT USING (public.can_read_tenant(tenant_id));

-- Only CK internal users can create/update/delete
CREATE POLICY section_statuses_insert ON section_statuses
  FOR INSERT WITH CHECK (public.is_internal());

CREATE POLICY section_statuses_update ON section_statuses
  FOR UPDATE USING (public.is_internal());

CREATE POLICY section_statuses_delete ON section_statuses
  FOR DELETE USING (public.is_internal());
