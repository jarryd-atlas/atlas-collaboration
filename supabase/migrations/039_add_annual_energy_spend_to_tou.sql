-- Add annual_energy_spend to site_tou_schedule
-- This column was missing, causing the baseline form energy section save to fail
-- (PostgREST rejects unknown columns, breaking the entire upsert)

ALTER TABLE site_tou_schedule
  ADD COLUMN IF NOT EXISTS annual_energy_spend numeric;
