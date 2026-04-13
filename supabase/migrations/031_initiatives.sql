-- ═══════════════════════════════════════════════════════════════
-- 031: Customer Initiatives — Collaborative Workstream Tracking
-- ═══════════════════════════════════════════════════════════════

-- Extend existing enums for polymorphic tables (comments, attachments, activity_log, notifications)
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'initiative';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'initiative_updated';

-- New status enum for initiatives (distinct from task/milestone statuses)
DO $$ BEGIN
  CREATE TYPE initiative_status AS ENUM ('active', 'on_hold', 'waiting', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── initiatives ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS initiatives (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  status          initiative_status NOT NULL DEFAULT 'active',
  priority        priority_level NOT NULL DEFAULT 'medium',
  owner_id        uuid NOT NULL REFERENCES profiles(id),
  target_date     date,
  completed_at    timestamptz,
  sort_order      integer DEFAULT 0,
  metadata        jsonb DEFAULT '{}',
  created_by      uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS initiatives_customer_idx ON initiatives(customer_id);
CREATE INDEX IF NOT EXISTS initiatives_tenant_idx ON initiatives(tenant_id);
CREATE INDEX IF NOT EXISTS initiatives_owner_idx ON initiatives(owner_id);
CREATE INDEX IF NOT EXISTS initiatives_status_idx ON initiatives(status);

-- ─── initiative_stakeholders ────────────────────────────────

CREATE TABLE IF NOT EXISTS initiative_stakeholders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id   uuid NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  stakeholder_id  uuid NOT NULL REFERENCES account_stakeholders(id) ON DELETE CASCADE,
  role            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(initiative_id, stakeholder_id)
);

CREATE INDEX IF NOT EXISTS initiative_stakeholders_initiative_idx ON initiative_stakeholders(initiative_id);
CREATE INDEX IF NOT EXISTS initiative_stakeholders_stakeholder_idx ON initiative_stakeholders(stakeholder_id);

-- ─── initiative_tasks ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS initiative_tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id   uuid NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  task_id         uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(initiative_id, task_id)
);

CREATE INDEX IF NOT EXISTS initiative_tasks_initiative_idx ON initiative_tasks(initiative_id);
CREATE INDEX IF NOT EXISTS initiative_tasks_task_idx ON initiative_tasks(task_id);

-- ─── initiative_decisions ───────────────────────────────────

CREATE TABLE IF NOT EXISTS initiative_decisions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id   uuid NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  decided_by      uuid REFERENCES profiles(id),
  decided_at      timestamptz NOT NULL DEFAULT now(),
  sort_order      integer DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS initiative_decisions_initiative_idx ON initiative_decisions(initiative_id);

-- ─── RLS Policies ───────────────────────────────────────────

ALTER TABLE initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE initiative_stakeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE initiative_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE initiative_decisions ENABLE ROW LEVEL SECURITY;

-- initiatives: collaborative (customer-visible)
CREATE POLICY initiatives_select ON initiatives FOR SELECT USING (public.can_read_tenant(tenant_id));
CREATE POLICY initiatives_insert ON initiatives FOR INSERT WITH CHECK (public.is_active());
CREATE POLICY initiatives_update ON initiatives FOR UPDATE USING (public.is_active());
CREATE POLICY initiatives_delete ON initiatives FOR DELETE USING (public.is_internal());

-- initiative_stakeholders
CREATE POLICY initiative_stakeholders_select ON initiative_stakeholders FOR SELECT
  USING (EXISTS (SELECT 1 FROM initiatives i WHERE i.id = initiative_id AND public.can_read_tenant(i.tenant_id)));
CREATE POLICY initiative_stakeholders_insert ON initiative_stakeholders FOR INSERT WITH CHECK (public.is_active());
CREATE POLICY initiative_stakeholders_delete ON initiative_stakeholders FOR DELETE USING (public.is_active());

-- initiative_tasks
CREATE POLICY initiative_tasks_select ON initiative_tasks FOR SELECT
  USING (EXISTS (SELECT 1 FROM initiatives i WHERE i.id = initiative_id AND public.can_read_tenant(i.tenant_id)));
CREATE POLICY initiative_tasks_insert ON initiative_tasks FOR INSERT WITH CHECK (public.is_active());
CREATE POLICY initiative_tasks_delete ON initiative_tasks FOR DELETE USING (public.is_active());

-- initiative_decisions: collaborative
CREATE POLICY initiative_decisions_select ON initiative_decisions FOR SELECT
  USING (public.can_read_tenant(tenant_id));
CREATE POLICY initiative_decisions_insert ON initiative_decisions FOR INSERT WITH CHECK (public.is_active());
CREATE POLICY initiative_decisions_update ON initiative_decisions FOR UPDATE USING (public.is_active());
CREATE POLICY initiative_decisions_delete ON initiative_decisions FOR DELETE USING (public.is_internal());

-- ─── Triggers ───────────────────────────────────────────────

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['initiatives', 'initiative_decisions']) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at' AND tgrelid = t::regclass) THEN
      EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t);
    END IF;
  END LOOP;
END;
$$;
