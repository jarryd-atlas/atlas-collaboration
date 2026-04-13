-- ============================================================
-- Quarterly Rocks (EOS-style goal tracking)
-- ============================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE rock_level AS ENUM ('individual', 'team', 'department', 'company');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE rock_status AS ENUM ('on_track', 'off_track', 'complete', 'incomplete');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Main table
CREATE TABLE IF NOT EXISTS rocks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  description     text,
  level           rock_level NOT NULL,
  status          rock_status NOT NULL DEFAULT 'on_track',
  quarter         smallint NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  year            smallint NOT NULL,
  owner_id        uuid REFERENCES profiles(id),
  parent_rock_id  uuid REFERENCES rocks(id) ON DELETE SET NULL,
  team_name       text,
  department_name text,
  completed_at    timestamptz,
  created_by      uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS rocks_owner_idx ON rocks(owner_id);
CREATE INDEX IF NOT EXISTS rocks_quarter_year_idx ON rocks(year, quarter);
CREATE INDEX IF NOT EXISTS rocks_parent_idx ON rocks(parent_rock_id);

-- RLS (internal-only)
ALTER TABLE rocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY rocks_select ON rocks FOR SELECT USING (public.is_internal());
CREATE POLICY rocks_insert ON rocks FOR INSERT WITH CHECK (public.is_internal());
CREATE POLICY rocks_update ON rocks FOR UPDATE USING (public.is_internal());
CREATE POLICY rocks_delete ON rocks FOR DELETE USING (public.is_internal());

-- Auto-update timestamp
CREATE TRIGGER set_updated_at BEFORE UPDATE ON rocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
