-- ═══════════════════════════════════════════════════════════════
-- 030: Baseline Form — Interactive data collection for site contacts
-- Adds form tracking columns and audit trail support
-- ═══════════════════════════════════════════════════════════════

-- Form type and progress tracking on assessment_interviews
ALTER TABLE assessment_interviews
  ADD COLUMN IF NOT EXISTS form_type text DEFAULT 'voice',
  ADD COLUMN IF NOT EXISTS form_progress jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

-- Audit: source attribution (internal vs baseline_form)
ALTER TABLE site_contacts
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS last_edited_by uuid REFERENCES profiles(id);

ALTER TABLE site_equipment
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'internal';
-- site_equipment already has contributed_by column

ALTER TABLE site_operational_params
  ADD COLUMN IF NOT EXISTS last_edited_by uuid REFERENCES profiles(id);

ALTER TABLE site_tou_schedule
  ADD COLUMN IF NOT EXISTS last_edited_by uuid REFERENCES profiles(id);

ALTER TABLE site_operations
  ADD COLUMN IF NOT EXISTS last_edited_by uuid REFERENCES profiles(id);

ALTER TABLE site_labor_baseline
  ADD COLUMN IF NOT EXISTS last_edited_by uuid REFERENCES profiles(id);
