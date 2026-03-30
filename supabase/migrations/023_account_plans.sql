-- ATLAS Collaborate — Account Planning
-- Company-level strategy, stakeholders/org chart, success plans, and enterprise deals

-- ═══════════════════════════════════════════════════════════════
-- Account Plans — one per customer, stores strategy content
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE account_plans (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_stage         text NOT NULL DEFAULT 'pilot',
  strategy_notes        text,
  whitespace_notes      text,
  expansion_targets     text,
  competitive_landscape text,
  win_themes            text,
  total_addressable_sites integer,
  created_by            uuid REFERENCES profiles(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(customer_id)
);

CREATE INDEX account_plans_customer_idx ON account_plans(customer_id);
CREATE INDEX account_plans_tenant_idx ON account_plans(tenant_id);

-- ═══════════════════════════════════════════════════════════════
-- Account Stakeholders — org chart nodes + key contacts
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE account_stakeholders (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_plan_id       uuid NOT NULL REFERENCES account_plans(id) ON DELETE CASCADE,
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reports_to            uuid REFERENCES account_stakeholders(id) ON DELETE SET NULL,
  name                  text NOT NULL,
  title                 text,
  email                 text,
  phone                 text,
  department            text,
  stakeholder_role      text,
  relationship_strength text,
  strategy_notes        text,
  notes                 text,
  is_ai_suggested       boolean NOT NULL DEFAULT false,
  sort_order            integer DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX account_stakeholders_plan_idx ON account_stakeholders(account_plan_id);
CREATE INDEX account_stakeholders_tenant_idx ON account_stakeholders(tenant_id);
CREATE INDEX account_stakeholders_reports_to_idx ON account_stakeholders(reports_to);

-- ═══════════════════════════════════════════════════════════════
-- Success Plan Goals — shared goals (collaborative)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE success_plan_goals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_plan_id uuid NOT NULL REFERENCES account_plans(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  is_achieved     boolean NOT NULL DEFAULT false,
  created_by      uuid REFERENCES profiles(id),
  sort_order      integer DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX success_plan_goals_plan_idx ON success_plan_goals(account_plan_id);

-- ═══════════════════════════════════════════════════════════════
-- Success Plan Milestones — proof points with dates
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE success_plan_milestones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_plan_id uuid NOT NULL REFERENCES account_plans(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  target_date     date,
  completed_date  date,
  status          text NOT NULL DEFAULT 'planned',
  evidence_notes  text,
  created_by      uuid REFERENCES profiles(id),
  sort_order      integer DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX success_plan_milestones_plan_idx ON success_plan_milestones(account_plan_id);

-- ═══════════════════════════════════════════════════════════════
-- Enterprise Deals — company-level deal (internal only)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE enterprise_deals (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id       uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  deal_name         text NOT NULL,
  target_value      numeric(12,2),
  deal_stage        text DEFAULT 'identified',
  target_close_date date,
  hubspot_deal_id   text,
  notes             text,
  created_by        uuid REFERENCES profiles(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(customer_id)
);

CREATE INDEX enterprise_deals_customer_idx ON enterprise_deals(customer_id);
CREATE INDEX enterprise_deals_tenant_idx ON enterprise_deals(tenant_id);

-- ═══════════════════════════════════════════════════════════════
-- Updated_at triggers
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY['account_plans', 'account_stakeholders', 'success_plan_goals', 'success_plan_milestones', 'enterprise_deals'])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at' AND tgrelid = t::regclass
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
        t
      );
    END IF;
  END LOOP;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- RLS Policies
-- ═══════════════════════════════════════════════════════════════

-- Enable RLS on all new tables
ALTER TABLE account_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_stakeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE success_plan_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE success_plan_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_deals ENABLE ROW LEVEL SECURITY;

-- account_plans: read by tenant, write by internal only
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY['account_plans', 'account_stakeholders'])
  LOOP
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (public.can_read_tenant(tenant_id))', t || '_select', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT WITH CHECK (public.is_internal())', t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE USING (public.is_internal())', t || '_update', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE USING (public.is_internal())', t || '_delete', t);
  END LOOP;
END;
$$;

-- success_plan_goals: read by tenant, insert/update by active (both CK + customer), delete by internal
CREATE POLICY success_plan_goals_select ON success_plan_goals FOR SELECT USING (public.can_read_tenant(tenant_id));
CREATE POLICY success_plan_goals_insert ON success_plan_goals FOR INSERT WITH CHECK (public.is_active());
CREATE POLICY success_plan_goals_update ON success_plan_goals FOR UPDATE USING (public.is_active());
CREATE POLICY success_plan_goals_delete ON success_plan_goals FOR DELETE USING (public.is_internal());

-- success_plan_milestones: read by tenant, insert/delete by internal, update by active (customer can mark complete)
CREATE POLICY success_plan_milestones_select ON success_plan_milestones FOR SELECT USING (public.can_read_tenant(tenant_id));
CREATE POLICY success_plan_milestones_insert ON success_plan_milestones FOR INSERT WITH CHECK (public.is_internal());
CREATE POLICY success_plan_milestones_update ON success_plan_milestones FOR UPDATE USING (public.is_active());
CREATE POLICY success_plan_milestones_delete ON success_plan_milestones FOR DELETE USING (public.is_internal());

-- enterprise_deals: fully internal only
CREATE POLICY enterprise_deals_select ON enterprise_deals FOR SELECT USING (public.is_internal());
CREATE POLICY enterprise_deals_insert ON enterprise_deals FOR INSERT WITH CHECK (public.is_internal());
CREATE POLICY enterprise_deals_update ON enterprise_deals FOR UPDATE USING (public.is_internal());
CREATE POLICY enterprise_deals_delete ON enterprise_deals FOR DELETE USING (public.is_internal());
