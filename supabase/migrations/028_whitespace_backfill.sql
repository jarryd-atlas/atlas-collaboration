-- Change default from 'prospect' to 'whitespace'
ALTER TABLE sites ALTER COLUMN pipeline_stage SET DEFAULT 'whitespace';

-- Backfill: sites that are "prospect" with no linked deal → whitespace
UPDATE sites
SET pipeline_stage = 'whitespace'
WHERE pipeline_stage = 'prospect'
  AND NOT EXISTS (
    SELECT 1 FROM hubspot_site_links WHERE hubspot_site_links.site_id = sites.id
  );
