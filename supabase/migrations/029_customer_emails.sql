-- Customer emails synced from Gmail, matched to customers by domain
CREATE TABLE customer_emails (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id       uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  gmail_message_id  text NOT NULL,
  gmail_thread_id   text NOT NULL,
  subject           text,
  snippet           text,                    -- Gmail API snippet (~200 chars plain text)
  body_plain        text,                    -- First ~1000 chars of plain text body
  from_email        text NOT NULL,
  from_name         text,
  to_emails         jsonb NOT NULL DEFAULT '[]',  -- [{email, name}]
  cc_emails         jsonb NOT NULL DEFAULT '[]',  -- [{email, name}]
  date              timestamptz NOT NULL,
  direction         text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  ck_user_id        uuid REFERENCES auth.users(id),
  ck_user_email     text,
  label_ids         jsonb DEFAULT '[]',
  synced_at         timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(gmail_message_id)
);

CREATE INDEX customer_emails_customer_idx ON customer_emails(customer_id);
CREATE INDEX customer_emails_tenant_idx ON customer_emails(tenant_id);
CREATE INDEX customer_emails_date_idx ON customer_emails(date DESC);
CREATE INDEX customer_emails_thread_idx ON customer_emails(gmail_thread_id);
CREATE INDEX customer_emails_ck_user_idx ON customer_emails(ck_user_id);

ALTER TABLE customer_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY customer_emails_select ON customer_emails FOR SELECT USING (public.is_internal());
CREATE POLICY customer_emails_insert ON customer_emails FOR INSERT WITH CHECK (true);
CREATE POLICY customer_emails_update ON customer_emails FOR UPDATE USING (public.is_internal());
CREATE POLICY customer_emails_delete ON customer_emails FOR DELETE USING (public.is_internal());

-- AI-generated communication pulse per customer
CREATE TABLE customer_email_digests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id       uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_start      timestamptz NOT NULL,
  period_end        timestamptz NOT NULL,
  email_count       integer NOT NULL DEFAULT 0,
  narrative         text NOT NULL,
  key_topics        jsonb NOT NULL DEFAULT '[]',
  key_contacts      jsonb NOT NULL DEFAULT '[]',
  action_items      jsonb NOT NULL DEFAULT '[]',
  sentiment         text CHECK (sentiment IN ('positive', 'neutral', 'cautious', 'at_risk')),
  momentum          text CHECK (momentum IN ('accelerating', 'steady', 'slowing', 'stalled')),
  generated_at      timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(customer_id)
);

ALTER TABLE customer_email_digests ENABLE ROW LEVEL SECURITY;
CREATE POLICY customer_email_digests_select ON customer_email_digests FOR SELECT USING (public.is_internal());
CREATE POLICY customer_email_digests_insert ON customer_email_digests FOR INSERT WITH CHECK (true);
CREATE POLICY customer_email_digests_update ON customer_email_digests FOR UPDATE USING (public.is_internal());
CREATE POLICY customer_email_digests_delete ON customer_email_digests FOR DELETE USING (public.is_internal());
