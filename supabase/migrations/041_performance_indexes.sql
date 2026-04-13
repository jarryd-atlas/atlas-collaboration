-- ═══════════════════════════════════════════════════════════════
-- Performance Indexes — address slow search, navigation, and RLS
-- ═══════════════════════════════════════════════════════════════

-- Enable pg_trgm for fast ILIKE / similarity searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── Full-text search for voice_notes and transcriptions ──────
-- Currently searched via slow ILIKE; add generated tsvector columns
-- Use DO blocks because ADD COLUMN IF NOT EXISTS doesn't support GENERATED

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voice_notes' AND column_name = 'search_vector'
  ) THEN
    ALTER TABLE voice_notes ADD COLUMN search_vector tsvector
      GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(title, ''))
      ) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS voice_notes_search_idx
  ON voice_notes USING gin(search_vector);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transcriptions' AND column_name = 'search_vector'
  ) THEN
    ALTER TABLE transcriptions ADD COLUMN search_vector tsvector
      GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(summary, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(raw_text, '')), 'B')
      ) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS transcriptions_search_idx
  ON transcriptions USING gin(search_vector);

-- ── Customer name trigram index for fast ILIKE search ────────
CREATE INDEX IF NOT EXISTS customers_name_trgm_idx
  ON customers USING gin(name gin_trgm_ops);

-- ── Missing tenant_id indexes (critical for RLS performance) ─
CREATE INDEX IF NOT EXISTS success_plan_goals_tenant_idx
  ON success_plan_goals(tenant_id);

CREATE INDEX IF NOT EXISTS success_plan_milestones_tenant_idx
  ON success_plan_milestones(tenant_id);

CREATE INDEX IF NOT EXISTS site_ops_params_tenant_idx
  ON site_operational_params(tenant_id);

CREATE INDEX IF NOT EXISTS site_operations_tenant_idx
  ON site_operations(tenant_id);

CREATE INDEX IF NOT EXISTS site_savings_tenant_idx
  ON site_savings_analysis(tenant_id);

-- ── Missing junction / foreign-key indexes ───────────────────
CREATE INDEX IF NOT EXISTS task_sites_task_idx
  ON task_sites(task_id);

CREATE INDEX IF NOT EXISTS meeting_items_assignee_idx
  ON meeting_items(assignee_id);

CREATE INDEX IF NOT EXISTS meeting_participants_profile_idx
  ON meeting_participants(profile_id, series_id);

-- ── Composite indexes for common query patterns ─────────────
CREATE INDEX IF NOT EXISTS customer_emails_cust_date_idx
  ON customer_emails(customer_id, date DESC);

CREATE INDEX IF NOT EXISTS customer_meetings_cust_date_idx
  ON customer_meetings(customer_id, meeting_date DESC);

-- ── Partial indexes for hot-path queries ─────────────────────
CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS flagged_issues_open_idx
  ON flagged_issues(site_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS tasks_open_customer_idx
  ON tasks(customer_id)
  WHERE status != 'done';
