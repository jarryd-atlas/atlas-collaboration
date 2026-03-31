-- ATLAS Collaborate — Meeting Briefs
-- Stores AI-researched attendee dossiers for upcoming customer meetings

CREATE TABLE meeting_briefs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title                 text NOT NULL,
  meeting_date          date,
  raw_attendee_input    text,
  researched_attendees  jsonb NOT NULL DEFAULT '[]',
  created_by            uuid REFERENCES profiles(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX meeting_briefs_customer_idx ON meeting_briefs(customer_id);
CREATE INDEX meeting_briefs_tenant_idx ON meeting_briefs(tenant_id);

ALTER TABLE meeting_briefs ENABLE ROW LEVEL SECURITY;

-- Internal only (same as enterprise_deals)
CREATE POLICY meeting_briefs_select ON meeting_briefs FOR SELECT USING (public.is_internal());
CREATE POLICY meeting_briefs_insert ON meeting_briefs FOR INSERT WITH CHECK (public.is_internal());
CREATE POLICY meeting_briefs_update ON meeting_briefs FOR UPDATE USING (public.is_internal());
CREATE POLICY meeting_briefs_delete ON meeting_briefs FOR DELETE USING (public.is_internal());
