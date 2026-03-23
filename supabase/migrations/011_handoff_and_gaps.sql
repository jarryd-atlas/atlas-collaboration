-- ATLAS Collaborate — Handoff Report + Data Gap Fields
-- Adds missing fields from sales handoff doc, site contacts table, handoff reports pointer

-- ═══════════════════════════════════════════════════════════════
-- GAP 1: Utility Account Info on site_tou_schedule
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE site_tou_schedule
  ADD COLUMN IF NOT EXISTS account_number text,
  ADD COLUMN IF NOT EXISTS meter_number text,
  ADD COLUMN IF NOT EXISTS rate_name text,
  ADD COLUMN IF NOT EXISTS rate_id_external text,
  ADD COLUMN IF NOT EXISTS demand_response_status text DEFAULT 'not_evaluated';

-- ═══════════════════════════════════════════════════════════════
-- GAP 2: Key Site Contacts
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS site_contacts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES site_assessments(id) ON DELETE CASCADE,
  site_id       uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          text NOT NULL,
  title         text,
  email         text,
  phone         text,
  is_primary    boolean DEFAULT false,
  sort_order    integer DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_contacts_site_idx ON site_contacts(site_id);
CREATE INDEX IF NOT EXISTS site_contacts_tenant_idx ON site_contacts(tenant_id);

-- ═══════════════════════════════════════════════════════════════
-- GAP 3: Post-ATLAS Power Results on site_savings_analysis
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE site_savings_analysis
  ADD COLUMN IF NOT EXISTS post_atlas_annual_kwh numeric,
  ADD COLUMN IF NOT EXISTS pre_atlas_avg_power_kw numeric,
  ADD COLUMN IF NOT EXISTS post_atlas_avg_power_kw numeric,
  ADD COLUMN IF NOT EXISTS post_atlas_peak_demand_kw numeric,
  ADD COLUMN IF NOT EXISTS ds_compressor_flexibility_pct numeric;

-- ═══════════════════════════════════════════════════════════════
-- GAP 4: Site Survey / Upgrades on site_operational_params
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE site_operational_params
  ADD COLUMN IF NOT EXISTS required_upgrades text,
  ADD COLUMN IF NOT EXISTS estimated_upgrade_cost numeric,
  ADD COLUMN IF NOT EXISTS survey_completed_date date,
  ADD COLUMN IF NOT EXISTS survey_notes text;

-- ═══════════════════════════════════════════════════════════════
-- Handoff Reports — pointer table (no assessment data duplication)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS handoff_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES site_assessments(id) ON DELETE CASCADE,
  slug          uuid NOT NULL DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  generated_by  uuid REFERENCES profiles(id),
  generated_at  timestamptz NOT NULL DEFAULT now(),
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(slug),
  UNIQUE(site_id)
);

CREATE INDEX IF NOT EXISTS handoff_reports_tenant_idx ON handoff_reports(tenant_id);

-- ═══════════════════════════════════════════════════════════════
-- Updated_at triggers
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY['site_contacts', 'handoff_reports'])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at' AND tgrelid = t::regclass
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
        t
      );
    END IF;
  END LOOP;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- RLS Policies
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE site_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE handoff_reports ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY['site_contacts', 'handoff_reports'])
  LOOP
    -- Only create if not exists
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
