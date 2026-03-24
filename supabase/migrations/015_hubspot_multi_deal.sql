-- Allow multiple deals per site (was 1:1, now many:1)
ALTER TABLE hubspot_site_links DROP CONSTRAINT IF EXISTS hubspot_site_links_site_id_key;
ALTER TABLE hubspot_site_links ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT false;
