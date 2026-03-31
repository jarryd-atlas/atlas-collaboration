-- ATLAS Collaborate — Company Intelligence Fields
-- Stores AI-researched company mission, vision, values, priorities

ALTER TABLE account_plans
  ADD COLUMN IF NOT EXISTS company_mission text,
  ADD COLUMN IF NOT EXISTS company_vision text,
  ADD COLUMN IF NOT EXISTS company_values text,
  ADD COLUMN IF NOT EXISTS company_priorities text,
  ADD COLUMN IF NOT EXISTS industry_vertical text,
  ADD COLUMN IF NOT EXISTS key_initiatives text,
  ADD COLUMN IF NOT EXISTS intelligence_fetched_at timestamptz;
