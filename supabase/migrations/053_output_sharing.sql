-- Output Sharing: Permission-gated visibility of assessment sections for customers.
-- CK controls which sections customers can see on the baseline tab.

CREATE TABLE output_sharing_permissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  section_key     text NOT NULL,
  shared_by       uuid NOT NULL REFERENCES profiles(id),
  shared_at       timestamptz NOT NULL DEFAULT now(),
  revoked_at      timestamptz,
);

-- Only one active (non-revoked) share per site+section
CREATE UNIQUE INDEX unique_active_share ON output_sharing_permissions(site_id, section_key)
  WHERE revoked_at IS NULL;

CREATE INDEX output_sharing_site_idx ON output_sharing_permissions(site_id);

-- RLS policies
ALTER TABLE output_sharing_permissions ENABLE ROW LEVEL SECURITY;

-- Both CK and customer can read (customers need to know what's shared)
CREATE POLICY output_sharing_select ON output_sharing_permissions
  FOR SELECT USING (public.can_read_tenant(tenant_id));

-- Only CK can manage sharing
CREATE POLICY output_sharing_insert ON output_sharing_permissions
  FOR INSERT WITH CHECK (public.is_internal());

CREATE POLICY output_sharing_update ON output_sharing_permissions
  FOR UPDATE USING (public.is_internal());

CREATE POLICY output_sharing_delete ON output_sharing_permissions
  FOR DELETE USING (public.is_internal());
