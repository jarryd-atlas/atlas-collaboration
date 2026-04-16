-- ════════════════════════════════════════════════════════════════════════════════
-- 059 · Account 360 RPC — bypass PostgREST schema cache for new columns
-- ════════════════════════════════════════════════════════════════════════════════
-- PostgREST caches table schemas and may not pick up new columns (customer_id,
-- cadence) added in 058 until the cache is reloaded.  This migration creates a
-- SECURITY DEFINER function that inserts via raw SQL, bypassing column validation.
-- It also drops the CHECK constraint so the fallback insert-then-update path works.

-- Drop the CHECK so a plain INSERT (without customer_id) doesn't fail
ALTER TABLE meeting_series DROP CONSTRAINT IF EXISTS meeting_series_account_360_customer;

-- RPC: create_account360_series  ─────────────────────────────────────────────
-- Called from the server action when creating an Account 360 series.
-- Uses raw SQL so PostgREST's stale column cache is irrelevant.
CREATE OR REPLACE FUNCTION public.create_account360_series(
  p_tenant_id uuid,
  p_type      text,
  p_title     text,
  p_created_by uuid,
  p_customer_id uuid,
  p_cadence   text DEFAULT 'weekly'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO meeting_series (tenant_id, type, title, created_by, customer_id, cadence)
  VALUES (p_tenant_id, p_type, p_title, p_created_by, p_customer_id, p_cadence)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Grant execute to the roles used by the Supabase clients
GRANT EXECUTE ON FUNCTION public.create_account360_series TO authenticated, service_role;

-- Reload PostgREST schema cache so it picks up this function (and the 058 columns)
NOTIFY pgrst, 'reload schema';
