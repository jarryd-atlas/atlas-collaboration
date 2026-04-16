-- ══════════════════════════════════════════════════════════════
-- 054: Activity Feed Enhancement
-- Add site_id, customer_id, and customer_visible to activity_log
-- for scoped feed queries at site, company, and portfolio levels.
-- ══════════════════════════════════════════════════════════════

-- Add columns for scoped feed queries
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES sites(id);
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id);

-- Add visibility flag: internal-only vs customer-visible
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS customer_visible boolean NOT NULL DEFAULT false;

-- Add new entity types for activity tracking
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'section_status';
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'document';

-- Indexes for feed queries at each scope
CREATE INDEX IF NOT EXISTS idx_activity_log_site ON activity_log(site_id, created_at DESC) WHERE site_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_log_customer ON activity_log(customer_id, created_at DESC) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_log_tenant_created ON activity_log(tenant_id, created_at DESC);

-- Backfill: set site_id from entity_id where entity_type = 'site'
UPDATE activity_log SET site_id = entity_id WHERE entity_type = 'site' AND site_id IS NULL;
