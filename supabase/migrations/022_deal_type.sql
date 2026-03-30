-- Add deal_type to hubspot_site_links to distinguish new business from renewal deals
ALTER TABLE hubspot_site_links ADD COLUMN IF NOT EXISTS deal_type text;
