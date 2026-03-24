-- ATLAS Collaborate — Site Interview Agent
-- Tracks AI-conducted voice interviews for baseline data collection

CREATE TYPE interview_status AS ENUM ('in_progress', 'completed', 'paused');

CREATE TABLE IF NOT EXISTS site_interviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  assessment_id   uuid REFERENCES site_assessments(id) ON DELETE SET NULL,
  started_by      uuid REFERENCES profiles(id),
  status          interview_status NOT NULL DEFAULT 'in_progress',
  transcript      jsonb DEFAULT '[]',
  fields_collected jsonb DEFAULT '{}',
  duration_sec    integer DEFAULT 0,
  section_reached text DEFAULT 'welcome',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_interviews_site_idx ON site_interviews(site_id);
CREATE INDEX IF NOT EXISTS site_interviews_tenant_idx ON site_interviews(tenant_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at' AND tgrelid = 'site_interviews'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON site_interviews
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END;
$$;

ALTER TABLE site_interviews ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text := 'site_interviews';
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
