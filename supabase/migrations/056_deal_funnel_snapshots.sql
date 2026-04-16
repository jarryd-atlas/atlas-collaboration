-- ATLAS Collaborate — Monthly Deal Funnel Snapshots
-- Stores month-end counts + total amount per HubSpot pipeline stage
-- so CRO can track funnel evolution over time.

-- ═══════════════════════════════════════════════════════════════
-- Table
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE deal_funnel_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pipeline_id     text NOT NULL,          -- HubSpot pipeline UUID
  snapshot_month  date NOT NULL,          -- first day of the month (e.g. 2026-04-01)
  stage_id        text NOT NULL,          -- HubSpot dealstage id
  stage_label     text NOT NULL,          -- denormalized at write time
  stage_order     int  NOT NULL,          -- 1..N for funnel sort
  deal_count      int  NOT NULL DEFAULT 0,
  total_amount    numeric(14, 2) NOT NULL DEFAULT 0,
  computed_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, pipeline_id, snapshot_month, stage_id)
);

CREATE INDEX deal_funnel_snapshots_tenant_month_idx
  ON deal_funnel_snapshots(tenant_id, pipeline_id, snapshot_month DESC);

CREATE INDEX deal_funnel_snapshots_tenant_stage_idx
  ON deal_funnel_snapshots(tenant_id, stage_id);

-- ═══════════════════════════════════════════════════════════════
-- RLS — read for tenant members, writes for internal only
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE deal_funnel_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY deal_funnel_snapshots_select
  ON deal_funnel_snapshots
  FOR SELECT
  USING (public.can_read_tenant(tenant_id));

CREATE POLICY deal_funnel_snapshots_insert
  ON deal_funnel_snapshots
  FOR INSERT
  WITH CHECK (public.is_internal());

CREATE POLICY deal_funnel_snapshots_update
  ON deal_funnel_snapshots
  FOR UPDATE
  USING (public.is_internal());

CREATE POLICY deal_funnel_snapshots_delete
  ON deal_funnel_snapshots
  FOR DELETE
  USING (public.is_internal());

-- ═══════════════════════════════════════════════════════════════
-- pg_cron — enqueue snapshot job on the 1st of each month
-- Wrapped in a DO block so local dev without pg_cron extension
-- still runs `supabase db reset` successfully.
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Unschedule if it already exists (idempotent re-runs)
    PERFORM cron.unschedule('enqueue-monthly-deal-funnel-snapshot')
    WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'enqueue-monthly-deal-funnel-snapshot'
    );

    PERFORM cron.schedule(
      'enqueue-monthly-deal-funnel-snapshot',
      '0 6 1 * *',  -- 06:00 UTC on day 1 of each month
      $CRON$
        INSERT INTO job_queue (type, payload, status)
        SELECT 'snapshot_deal_funnel',
               jsonb_build_object(
                 'tenant_id',   tenant_id,
                 'pipeline_id', 'f95a95c9-99c3-4b7f-a250-1303e9288649',
                 'mode',        'current_month'
               ),
               'pending'
          FROM hubspot_config
         WHERE is_active = true;
      $CRON$
    );
  ELSE
    RAISE NOTICE 'pg_cron extension not installed — skipping monthly deal funnel snapshot schedule. Enable pg_cron on Supabase Cloud and re-run migration 056 (or schedule manually).';
  END IF;
END;
$$;
