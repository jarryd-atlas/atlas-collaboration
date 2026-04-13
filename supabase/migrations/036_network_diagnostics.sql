-- ATLAS Collaborate — Network Diagnostics
-- Stores network context and speed test results collected via baseline form.

-- ═══════════════════════════════════════════════════════════════
-- Network diagnostics context (one per assessment)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS site_network_diagnostics (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id           uuid NOT NULL REFERENCES site_assessments(id) ON DELETE CASCADE,
  site_id                 uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  tenant_id               uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  isp_name                text DEFAULT '',
  connection_type         text DEFAULT '',
  has_backup_connection   boolean DEFAULT false,
  backup_connection_type  text DEFAULT '',
  known_issues            text DEFAULT '',
  network_stability_notes text DEFAULT '',
  last_edited_by          uuid REFERENCES profiles(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assessment_id)
);

CREATE INDEX IF NOT EXISTS site_network_diagnostics_site_idx ON site_network_diagnostics(site_id);
CREATE INDEX IF NOT EXISTS site_network_diagnostics_tenant_idx ON site_network_diagnostics(tenant_id);

-- ═══════════════════════════════════════════════════════════════
-- Network test results (many per assessment)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS site_network_test_results (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   uuid NOT NULL REFERENCES site_assessments(id) ON DELETE CASCADE,
  site_id         uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tested_at       timestamptz NOT NULL DEFAULT now(),
  download_mbps   numeric,
  upload_mbps     numeric,
  latency_ms      numeric,
  jitter_ms       numeric,
  user_agent      text DEFAULT '',
  connection_info text DEFAULT '',
  notes           text DEFAULT '',
  source          text DEFAULT 'baseline_form',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_network_test_results_assessment_idx ON site_network_test_results(assessment_id);
CREATE INDEX IF NOT EXISTS site_network_test_results_site_idx ON site_network_test_results(site_id);
CREATE INDEX IF NOT EXISTS site_network_test_results_tenant_idx ON site_network_test_results(tenant_id);

-- ═══════════════════════════════════════════════════════════════
-- Updated_at trigger for diagnostics table
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at' AND tgrelid = 'site_network_diagnostics'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON site_network_diagnostics
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- RLS Policies
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE site_network_diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_network_test_results ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['site_network_diagnostics', 'site_network_test_results'])
  LOOP
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
  END LOOP;
END;
$$;
