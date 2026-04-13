-- ═══════════════════════════════════════════════════════════════
-- 038: Add corporate HQ location fields to customers
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS hq_address text,
  ADD COLUMN IF NOT EXISTS hq_city text,
  ADD COLUMN IF NOT EXISTS hq_state text,
  ADD COLUMN IF NOT EXISTS hq_zip text,
  ADD COLUMN IF NOT EXISTS hq_latitude double precision,
  ADD COLUMN IF NOT EXISTS hq_longitude double precision;
