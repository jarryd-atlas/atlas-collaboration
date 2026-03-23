-- ATLAS Collaborate — AI Category Instructions
-- Admin-configurable prompts per document category for Claude analysis

CREATE TABLE IF NOT EXISTS ai_category_instructions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_key  text NOT NULL,
  instructions  text NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, category_key)
);

CREATE INDEX IF NOT EXISTS ai_category_instructions_tenant_idx ON ai_category_instructions(tenant_id);

-- Updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at' AND tgrelid = 'ai_category_instructions'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_category_instructions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END;
$$;

-- RLS
ALTER TABLE ai_category_instructions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text := 'ai_category_instructions';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = t || '_select') THEN
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (public.can_read_tenant(tenant_id))', t || '_select', t);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = t || '_insert') THEN
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT WITH CHECK (public.is_internal())', t || '_insert', t);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = t || '_update') THEN
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE USING (public.is_internal())', t || '_update', t);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = t || '_delete') THEN
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE USING (public.is_internal())', t || '_delete', t);
  END IF;
END;
$$;
