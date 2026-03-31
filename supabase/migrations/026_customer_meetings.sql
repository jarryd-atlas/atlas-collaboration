-- ATLAS Collaborate — Customer Meetings (synced from Google Calendar)
-- Stores meetings matched to customers by attendee email domain

CREATE TABLE customer_meetings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id       uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  google_event_id   text NOT NULL,
  title             text NOT NULL,
  description       text,
  meeting_date      timestamptz NOT NULL,
  meeting_end       timestamptz,
  location          text,
  html_link         text,
  organizer_email   text,
  attendees         jsonb NOT NULL DEFAULT '[]',
  ck_attendees      jsonb NOT NULL DEFAULT '[]',
  meeting_brief_id  uuid REFERENCES meeting_briefs(id) ON DELETE SET NULL,
  synced_at         timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(google_event_id)
);

CREATE INDEX customer_meetings_customer_idx ON customer_meetings(customer_id);
CREATE INDEX customer_meetings_tenant_idx ON customer_meetings(tenant_id);
CREATE INDEX customer_meetings_date_idx ON customer_meetings(meeting_date DESC);
CREATE INDEX customer_meetings_google_id_idx ON customer_meetings(google_event_id);

ALTER TABLE customer_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_meetings_select ON customer_meetings FOR SELECT USING (public.is_internal());
CREATE POLICY customer_meetings_insert ON customer_meetings FOR INSERT WITH CHECK (public.is_internal());
CREATE POLICY customer_meetings_update ON customer_meetings FOR UPDATE USING (public.is_internal());
CREATE POLICY customer_meetings_delete ON customer_meetings FOR DELETE USING (public.is_internal());
