-- Revenue forecast targets/quotas per period
-- Used by the Forecast tool to show attainment progress

CREATE TABLE forecast_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type TEXT NOT NULL CHECK (period_type IN ('quarter', 'year')),
  period_key TEXT NOT NULL,            -- e.g. "2026-Q2" or "2026"
  target_amount NUMERIC NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (period_type, period_key)
);

ALTER TABLE forecast_targets ENABLE ROW LEVEL SECURITY;

-- Internal users can read
CREATE POLICY forecast_targets_select ON forecast_targets
  FOR SELECT USING (public.is_internal());

-- Internal users can insert/update/delete
CREATE POLICY forecast_targets_insert ON forecast_targets
  FOR INSERT WITH CHECK (public.is_internal());

CREATE POLICY forecast_targets_update ON forecast_targets
  FOR UPDATE USING (public.is_internal());

CREATE POLICY forecast_targets_delete ON forecast_targets
  FOR DELETE USING (public.is_internal());
