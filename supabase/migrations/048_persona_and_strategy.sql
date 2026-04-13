-- ─── Phase 1: Persona type on stakeholders ───────────────────
ALTER TABLE account_stakeholders ADD COLUMN IF NOT EXISTS persona_type text;

-- ─── Phase 3: Buying triggers per customer ───────────────────
CREATE TABLE IF NOT EXISTS account_buying_triggers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  trigger_key   text,
  custom_label  text,
  persona_type  text,
  is_active     boolean NOT NULL DEFAULT true,
  fired_date    date,
  notes         text,
  created_by    uuid REFERENCES profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_abt_customer ON account_buying_triggers(customer_id);
ALTER TABLE account_buying_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY abt_select ON account_buying_triggers FOR SELECT USING (is_internal());
CREATE POLICY abt_insert ON account_buying_triggers FOR INSERT WITH CHECK (is_internal());
CREATE POLICY abt_update ON account_buying_triggers FOR UPDATE USING (is_internal());
CREATE POLICY abt_delete ON account_buying_triggers FOR DELETE USING (is_internal());

-- ─── Phase 3: Objections per customer ────────────────────────
CREATE TABLE IF NOT EXISTS account_objections (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id              uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tenant_id                uuid NOT NULL REFERENCES tenants(id),
  objection_key            text,
  custom_label             text,
  status                   text NOT NULL DEFAULT 'active',
  raised_by_stakeholder_id uuid REFERENCES account_stakeholders(id) ON DELETE SET NULL,
  notes                    text,
  resolution_notes         text,
  created_by               uuid REFERENCES profiles(id),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ao_customer ON account_objections(customer_id);
ALTER TABLE account_objections ENABLE ROW LEVEL SECURITY;
CREATE POLICY ao_select ON account_objections FOR SELECT USING (is_internal());
CREATE POLICY ao_insert ON account_objections FOR INSERT WITH CHECK (is_internal());
CREATE POLICY ao_update ON account_objections FOR UPDATE USING (is_internal());
CREATE POLICY ao_delete ON account_objections FOR DELETE USING (is_internal());

-- ─── Phase 4: Initiative categories ──────────────────────────
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS category text;
