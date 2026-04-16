-- Information Requests: Q&A threads between CK team and customer contacts.
-- Replaces Slack/email for "we need X from you" and "where are we on Y?"

-- Extend entity_type enum so comments table can reference info requests
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'info_request';

-- Extend notification_type enum for info request events
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'info_request_created';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'info_request_responded';

CREATE TABLE information_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  section_key     text,                   -- optional link to a discovery section
  title           text NOT NULL,
  description     text,
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'responded', 'resolved')),
  priority        priority_level NOT NULL DEFAULT 'medium',
  requested_by    uuid NOT NULL REFERENCES profiles(id),
  assigned_to     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_by     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX info_requests_site_idx ON information_requests(site_id);
CREATE INDEX info_requests_status_idx ON information_requests(status);
CREATE INDEX info_requests_assigned_idx ON information_requests(assigned_to);

-- RLS policies
ALTER TABLE information_requests ENABLE ROW LEVEL SECURITY;

-- Both CK and customer can read requests for their tenant
CREATE POLICY info_requests_select ON information_requests
  FOR SELECT USING (public.can_read_tenant(tenant_id));

-- Only CK internal users can create requests
CREATE POLICY info_requests_insert ON information_requests
  FOR INSERT WITH CHECK (public.is_internal());

-- CK can update any field; updates also happen via server actions with admin client
CREATE POLICY info_requests_update ON information_requests
  FOR UPDATE USING (public.is_internal());

-- Only CK can delete
CREATE POLICY info_requests_delete ON information_requests
  FOR DELETE USING (public.is_internal());
