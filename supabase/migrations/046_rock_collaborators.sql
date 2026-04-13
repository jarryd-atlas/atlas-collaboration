-- Rock collaborators: many-to-many join between rocks and profiles
CREATE TABLE rock_collaborators (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rock_id    uuid NOT NULL REFERENCES rocks(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rock_id, profile_id)
);

CREATE INDEX rock_collaborators_rock_idx ON rock_collaborators(rock_id);
CREATE INDEX rock_collaborators_profile_idx ON rock_collaborators(profile_id);

-- RLS (internal-only, same as rocks)
ALTER TABLE rock_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY rock_collaborators_select ON rock_collaborators FOR SELECT USING (public.is_internal());
CREATE POLICY rock_collaborators_insert ON rock_collaborators FOR INSERT WITH CHECK (public.is_internal());
CREATE POLICY rock_collaborators_update ON rock_collaborators FOR UPDATE USING (public.is_internal());
CREATE POLICY rock_collaborators_delete ON rock_collaborators FOR DELETE USING (public.is_internal());
