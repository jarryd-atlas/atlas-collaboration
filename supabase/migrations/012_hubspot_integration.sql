-- ATLAS Collaborate — HubSpot CRM Integration
-- Links HubSpot Deals to ATLAS Sites with configurable field mapping and sync

-- ═══════════════════════════════════════════════════════════════
-- Enums
-- ═══════════════════════════════════════════════════════════════

CREATE TYPE sync_direction AS ENUM ('hubspot_to_app', 'app_to_hubspot', 'bidirectional');
CREATE TYPE sync_status AS ENUM ('started', 'completed', 'failed', 'partial');

-- ═══════════════════════════════════════════════════════════════
-- HubSpot Config — connection credentials per tenant
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE hubspot_config (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  access_token    text NOT NULL,
  portal_id       text NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  last_synced_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

-- ═══════════════════════════════════════════════════════════════
-- HubSpot Site Links — Deal ↔ Site (1:1)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE hubspot_site_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_id         uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  hubspot_deal_id text NOT NULL,
  deal_name       text,
  linked_by       uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(site_id),
  UNIQUE(tenant_id, hubspot_deal_id)
);

CREATE INDEX hubspot_site_links_tenant_idx ON hubspot_site_links(tenant_id);
CREATE INDEX hubspot_site_links_site_idx ON hubspot_site_links(site_id);
CREATE INDEX hubspot_site_links_deal_idx ON hubspot_site_links(hubspot_deal_id);

-- ═══════════════════════════════════════════════════════════════
-- HubSpot Field Mappings — configurable field map
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE hubspot_field_mappings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  hubspot_property  text NOT NULL,
  app_table         text NOT NULL,
  app_column        text NOT NULL,
  direction         sync_direction NOT NULL DEFAULT 'hubspot_to_app',
  transform         text,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, hubspot_property, app_table, app_column)
);

CREATE INDEX hubspot_field_mappings_tenant_idx ON hubspot_field_mappings(tenant_id);

-- ═══════════════════════════════════════════════════════════════
-- HubSpot Sync Log — audit trail
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE hubspot_sync_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_link_id    uuid REFERENCES hubspot_site_links(id) ON DELETE SET NULL,
  direction       sync_direction NOT NULL,
  status          sync_status NOT NULL DEFAULT 'started',
  fields_synced   jsonb DEFAULT '[]',
  fields_skipped  jsonb DEFAULT '[]',
  error           text,
  triggered_by    text NOT NULL,
  initiated_by    uuid REFERENCES profiles(id),
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX hubspot_sync_log_tenant_idx ON hubspot_sync_log(tenant_id);
CREATE INDEX hubspot_sync_log_site_link_idx ON hubspot_sync_log(site_link_id);
CREATE INDEX hubspot_sync_log_created_idx ON hubspot_sync_log(created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- Updated_at triggers
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY['hubspot_config', 'hubspot_site_links', 'hubspot_field_mappings'])
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

ALTER TABLE hubspot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE hubspot_site_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE hubspot_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hubspot_sync_log ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY['hubspot_config', 'hubspot_site_links', 'hubspot_field_mappings', 'hubspot_sync_log'])
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
