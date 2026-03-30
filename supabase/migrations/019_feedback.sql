-- ════════════════════════════════════════════════════════════════════════════════
-- 019 · Feedback
-- ════════════════════════════════════════════════════════════════════════════════

-- Feedback type enum
CREATE TYPE feedback_category AS ENUM ('bug', 'feature_request', 'improvement', 'other');

CREATE TABLE feedback (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  category    feedback_category NOT NULL DEFAULT 'other',
  message     text NOT NULL,
  page_url    text,               -- which page the user was on
  status      text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'planned', 'done', 'dismissed')),
  admin_notes text,               -- internal notes from admin review
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_feedback_tenant ON feedback(tenant_id);
CREATE INDEX idx_feedback_status ON feedback(status);
CREATE INDEX idx_feedback_created ON feedback(created_at DESC);

-- RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert feedback for their own tenant
CREATE POLICY feedback_insert ON feedback FOR INSERT
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid);

-- Admin/super_admin can read all feedback
CREATE POLICY feedback_select ON feedback FOR SELECT
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
  );

-- Admin can update feedback (status, admin_notes)
CREATE POLICY feedback_update ON feedback FOR UPDATE
  USING (
    tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
  );

-- Updated-at trigger
CREATE TRIGGER set_feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
