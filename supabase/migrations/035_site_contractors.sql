-- ATLAS Collaborate — Site Contractors table
-- Tracks third-party contractors associated with a site (e.g. refrigeration service companies).
-- Referenced by baseline form actions but was never created in earlier migrations.

CREATE TABLE IF NOT EXISTS site_contractors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   uuid NOT NULL REFERENCES site_assessments(id) ON DELETE CASCADE,
  site_id         uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_name    text NOT NULL DEFAULT '',
  contractor_type text DEFAULT '',
  contact_name    text DEFAULT '',
  email           text DEFAULT '',
  phone           text DEFAULT '',
  notes           text DEFAULT '',
  source          text DEFAULT 'baseline_form',
  last_edited_by  uuid REFERENCES profiles(id),
  sort_order      integer DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_contractors_site_idx ON site_contractors(site_id);
CREATE INDEX IF NOT EXISTS site_contractors_assessment_idx ON site_contractors(assessment_id);
CREATE INDEX IF NOT EXISTS site_contractors_tenant_idx ON site_contractors(tenant_id);

-- Updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at' AND tgrelid = 'site_contractors'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON site_contractors
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END;
$$;

-- RLS (same pattern as site_contacts)
ALTER TABLE site_contractors ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text := 'site_contractors';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = t || '_select') THEN
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (public.can_read_tenant(tenant_id))', t || '_select', t);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = t || '_insert') THEN
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT WITH CHECK (public.is_internal())', t || '_insert', t);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = t || '_update') THEN
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE USING (public.is_internal())', t || '_update', t);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = t || '_delete') THEN
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE USING (public.is_internal())', t || '_delete', t);
  END IF;
END;
$$;
