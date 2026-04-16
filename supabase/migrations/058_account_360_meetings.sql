-- ════════════════════════════════════════════════════════════════════════════════
-- 058 · Account 360 meetings — typed meetings + customer focus + sections
-- ════════════════════════════════════════════════════════════════════════════════
-- Adds a third meeting type (`account_360`) that is:
--   • tied to a specific customer
--   • has a cadence (weekly/biweekly/monthly)
--   • visible AND editable by any internal CK user (not participant-gated)
--   • items can be grouped into named sections (cross-team grid, priorities,
--     blockers, marketing asks)
-- Existing standup / one_on_one behavior is preserved unchanged.

-- ─── Expand type constraint ────────────────────────────────────────────────
ALTER TABLE meeting_series DROP CONSTRAINT meeting_series_type_check;
ALTER TABLE meeting_series ADD CONSTRAINT meeting_series_type_check
  CHECK (type IN ('standup', 'one_on_one', 'account_360'));

-- ─── Customer + cadence for account_360 ────────────────────────────────────
ALTER TABLE meeting_series
  ADD COLUMN customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN cadence     text CHECK (cadence IN ('weekly', 'biweekly', 'monthly'));

ALTER TABLE meeting_series ADD CONSTRAINT meeting_series_account_360_customer
  CHECK (type <> 'account_360' OR customer_id IS NOT NULL);

CREATE INDEX idx_meeting_series_customer ON meeting_series(customer_id)
  WHERE customer_id IS NOT NULL;

-- ─── Sections on meeting items ─────────────────────────────────────────────
-- Allowed section keys (enforced in app, not DB, to stay flexible):
--   product_working | product_risks | product_opps
--   revenue_working | revenue_risks | revenue_opps
--   marketing_working | marketing_risks | marketing_opps
--   priorities | blockers | marketing_asks
ALTER TABLE meeting_items ADD COLUMN section text;
CREATE INDEX idx_meeting_items_section ON meeting_items(meeting_id, section);

-- ─── RLS: internal-wide access for account_360 ─────────────────────────────
-- Existing participant-based policies stay in place (they cover standup /
-- one_on_one). We add parallel OR-ed policies that apply only when the
-- parent series is type='account_360'.

-- meeting_series
CREATE POLICY meeting_series_select_account_360 ON meeting_series FOR SELECT
  USING (public.is_internal() AND type = 'account_360');
CREATE POLICY meeting_series_update_account_360 ON meeting_series FOR UPDATE
  USING (public.is_internal() AND type = 'account_360');
CREATE POLICY meeting_series_delete_account_360 ON meeting_series FOR DELETE
  USING (public.is_internal() AND type = 'account_360');

-- meetings
CREATE POLICY meetings_select_account_360 ON meetings FOR SELECT
  USING (public.is_internal() AND series_id IN (
    SELECT id FROM meeting_series WHERE type = 'account_360'
  ));
CREATE POLICY meetings_insert_account_360 ON meetings FOR INSERT
  WITH CHECK (public.is_internal() AND series_id IN (
    SELECT id FROM meeting_series WHERE type = 'account_360'
  ));
CREATE POLICY meetings_update_account_360 ON meetings FOR UPDATE
  USING (public.is_internal() AND series_id IN (
    SELECT id FROM meeting_series WHERE type = 'account_360'
  ));

-- meeting_items
CREATE POLICY meeting_items_select_account_360 ON meeting_items FOR SELECT
  USING (public.is_internal() AND meeting_id IN (
    SELECT m.id FROM meetings m
    JOIN meeting_series s ON s.id = m.series_id
    WHERE s.type = 'account_360'
  ));
CREATE POLICY meeting_items_insert_account_360 ON meeting_items FOR INSERT
  WITH CHECK (public.is_internal() AND meeting_id IN (
    SELECT m.id FROM meetings m
    JOIN meeting_series s ON s.id = m.series_id
    WHERE s.type = 'account_360'
  ));
CREATE POLICY meeting_items_update_account_360 ON meeting_items FOR UPDATE
  USING (public.is_internal() AND meeting_id IN (
    SELECT m.id FROM meetings m
    JOIN meeting_series s ON s.id = m.series_id
    WHERE s.type = 'account_360'
  ));
CREATE POLICY meeting_items_delete_account_360 ON meeting_items FOR DELETE
  USING (public.is_internal() AND meeting_id IN (
    SELECT m.id FROM meetings m
    JOIN meeting_series s ON s.id = m.series_id
    WHERE s.type = 'account_360'
  ));

-- meeting_participants: let any internal user read participants of an
-- account_360 series (so the "leads" chips render for everyone).
CREATE POLICY meeting_participants_select_account_360 ON meeting_participants FOR SELECT
  USING (public.is_internal() AND series_id IN (
    SELECT id FROM meeting_series WHERE type = 'account_360'
  ));

-- Reload PostgREST schema cache so it picks up the new columns immediately.
NOTIFY pgrst, 'reload schema';
