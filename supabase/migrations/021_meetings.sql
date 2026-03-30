-- ════════════════════════════════════════════════════════════════════════════════
-- 021 · Meetings Hub (standups, 1:1s)
-- ════════════════════════════════════════════════════════════════════════════════

-- ─── meeting_series: recurring meeting definitions ──────────────────────────

CREATE TABLE meeting_series (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('standup', 'one_on_one')),
  title       text NOT NULL,
  created_by  uuid NOT NULL REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_series_tenant ON meeting_series(tenant_id);

-- ─── meeting_participants: who belongs to a meeting series ──────────────────

CREATE TABLE meeting_participants (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  series_id   uuid NOT NULL REFERENCES meeting_series(id) ON DELETE CASCADE,
  profile_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(series_id, profile_id)
);

CREATE INDEX idx_meeting_participants_series ON meeting_participants(series_id);
CREATE INDEX idx_meeting_participants_profile ON meeting_participants(profile_id);

-- ─── meetings: individual meeting instances ─────────────────────────────────

CREATE TABLE meetings (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  series_id   uuid NOT NULL REFERENCES meeting_series(id) ON DELETE CASCADE,
  meeting_date date NOT NULL DEFAULT CURRENT_DATE,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meetings_series_date ON meetings(series_id, meeting_date DESC);

-- ─── meeting_items: notes, action items, talking points ─────────────────────

CREATE TABLE meeting_items (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id  uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('note', 'action_item', 'talking_point')),
  body        text NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  site_id     uuid REFERENCES sites(id) ON DELETE SET NULL,
  author_id   uuid NOT NULL REFERENCES profiles(id),
  assignee_id uuid REFERENCES profiles(id),
  due_date    date,
  completed   boolean NOT NULL DEFAULT false,
  task_id     uuid REFERENCES tasks(id) ON DELETE SET NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_items_meeting ON meeting_items(meeting_id, type);
CREATE INDEX idx_meeting_items_customer ON meeting_items(customer_id);
CREATE INDEX idx_meeting_items_task ON meeting_items(task_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE meeting_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_items ENABLE ROW LEVEL SECURITY;

-- meeting_series: internal users who are participants can access
CREATE POLICY meeting_series_select ON meeting_series FOR SELECT USING (
  public.is_internal() AND id IN (
    SELECT series_id FROM meeting_participants WHERE profile_id = public.profile_id()
  )
);
CREATE POLICY meeting_series_insert ON meeting_series FOR INSERT WITH CHECK (
  public.is_internal()
);
CREATE POLICY meeting_series_update ON meeting_series FOR UPDATE USING (
  public.is_internal() AND id IN (
    SELECT series_id FROM meeting_participants WHERE profile_id = public.profile_id()
  )
);

-- meeting_participants: accessible if you're a participant in the series
CREATE POLICY meeting_participants_select ON meeting_participants FOR SELECT USING (
  public.is_internal() AND series_id IN (
    SELECT series_id FROM meeting_participants WHERE profile_id = public.profile_id()
  )
);
CREATE POLICY meeting_participants_insert ON meeting_participants FOR INSERT WITH CHECK (
  public.is_internal()
);
CREATE POLICY meeting_participants_delete ON meeting_participants FOR DELETE USING (
  public.is_internal() AND series_id IN (
    SELECT series_id FROM meeting_participants WHERE profile_id = public.profile_id()
  )
);

-- meetings: accessible if you're a participant in the parent series
CREATE POLICY meetings_select ON meetings FOR SELECT USING (
  public.is_internal() AND series_id IN (
    SELECT series_id FROM meeting_participants WHERE profile_id = public.profile_id()
  )
);
CREATE POLICY meetings_insert ON meetings FOR INSERT WITH CHECK (
  public.is_internal() AND series_id IN (
    SELECT series_id FROM meeting_participants WHERE profile_id = public.profile_id()
  )
);
CREATE POLICY meetings_update ON meetings FOR UPDATE USING (
  public.is_internal() AND series_id IN (
    SELECT series_id FROM meeting_participants WHERE profile_id = public.profile_id()
  )
);

-- meeting_items: accessible through meeting → series → participant chain
CREATE POLICY meeting_items_select ON meeting_items FOR SELECT USING (
  public.is_internal() AND meeting_id IN (
    SELECT m.id FROM meetings m
    JOIN meeting_participants mp ON mp.series_id = m.series_id
    WHERE mp.profile_id = public.profile_id()
  )
);
CREATE POLICY meeting_items_insert ON meeting_items FOR INSERT WITH CHECK (
  public.is_internal() AND meeting_id IN (
    SELECT m.id FROM meetings m
    JOIN meeting_participants mp ON mp.series_id = m.series_id
    WHERE mp.profile_id = public.profile_id()
  )
);
CREATE POLICY meeting_items_update ON meeting_items FOR UPDATE USING (
  public.is_internal() AND meeting_id IN (
    SELECT m.id FROM meetings m
    JOIN meeting_participants mp ON mp.series_id = m.series_id
    WHERE mp.profile_id = public.profile_id()
  )
);
CREATE POLICY meeting_items_delete ON meeting_items FOR DELETE USING (
  public.is_internal() AND meeting_id IN (
    SELECT m.id FROM meetings m
    JOIN meeting_participants mp ON mp.series_id = m.series_id
    WHERE mp.profile_id = public.profile_id()
  )
);

-- ─── Updated-at triggers ────────────────────────────────────────────────────

CREATE TRIGGER set_meeting_series_updated_at
  BEFORE UPDATE ON meeting_series
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_meeting_items_updated_at
  BEFORE UPDATE ON meeting_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Realtime publication ───────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE meeting_items;
ALTER PUBLICATION supabase_realtime ADD TABLE meetings;
