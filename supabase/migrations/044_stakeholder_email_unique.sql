-- ============================================================
-- Phase 1: Deduplicate existing stakeholders by email
-- Keep the one with the most data (prefer non-AI-suggested, then most fields filled)
-- ============================================================

-- Delete duplicate stakeholders keeping the "best" one per (account_plan_id, email)
DELETE FROM account_stakeholders
WHERE id IN (
  SELECT a.id
  FROM account_stakeholders a
  JOIN account_stakeholders b
    ON LOWER(a.email) = LOWER(b.email)
    AND a.account_plan_id = b.account_plan_id
    AND a.id != b.id
  WHERE a.email IS NOT NULL
    AND (
      -- Prefer non-AI-suggested over AI-suggested
      (a.is_ai_suggested = true AND b.is_ai_suggested = false)
      OR (
        a.is_ai_suggested = b.is_ai_suggested
        AND (
          -- Prefer the one with more fields filled
          (CASE WHEN a.title IS NOT NULL THEN 1 ELSE 0 END
           + CASE WHEN a.department IS NOT NULL THEN 1 ELSE 0 END
           + CASE WHEN a.phone IS NOT NULL THEN 1 ELSE 0 END
           + CASE WHEN a.stakeholder_role IS NOT NULL THEN 1 ELSE 0 END
           + CASE WHEN a.notes IS NOT NULL THEN 1 ELSE 0 END)
          <
          (CASE WHEN b.title IS NOT NULL THEN 1 ELSE 0 END
           + CASE WHEN b.department IS NOT NULL THEN 1 ELSE 0 END
           + CASE WHEN b.phone IS NOT NULL THEN 1 ELSE 0 END
           + CASE WHEN b.stakeholder_role IS NOT NULL THEN 1 ELSE 0 END
           + CASE WHEN b.notes IS NOT NULL THEN 1 ELSE 0 END)
          OR (
            -- If equal fields, keep the older one (smaller id via created_at)
            (CASE WHEN a.title IS NOT NULL THEN 1 ELSE 0 END
             + CASE WHEN a.department IS NOT NULL THEN 1 ELSE 0 END
             + CASE WHEN a.phone IS NOT NULL THEN 1 ELSE 0 END
             + CASE WHEN a.stakeholder_role IS NOT NULL THEN 1 ELSE 0 END
             + CASE WHEN a.notes IS NOT NULL THEN 1 ELSE 0 END)
            =
            (CASE WHEN b.title IS NOT NULL THEN 1 ELSE 0 END
             + CASE WHEN b.department IS NOT NULL THEN 1 ELSE 0 END
             + CASE WHEN b.phone IS NOT NULL THEN 1 ELSE 0 END
             + CASE WHEN b.stakeholder_role IS NOT NULL THEN 1 ELSE 0 END
             + CASE WHEN b.notes IS NOT NULL THEN 1 ELSE 0 END)
            AND a.created_at > b.created_at
          )
        )
      )
    )
);

-- Create unique index (partial — only where email is set)
CREATE UNIQUE INDEX IF NOT EXISTS idx_stakeholder_email_unique
  ON account_stakeholders (account_plan_id, LOWER(email))
  WHERE email IS NOT NULL;

-- ============================================================
-- Phase 2: Backfill contacts from existing synced data
-- ============================================================

-- Helper: name from email prefix
CREATE OR REPLACE FUNCTION _name_from_email(p_email text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT initcap(replace(replace(split_part(p_email, '@', 1), '.', ' '), '_', ' '));
$$;

-- 2A: Backfill from customer_emails headers (from_email)
INSERT INTO account_stakeholders (account_plan_id, tenant_id, name, email, is_ai_suggested)
SELECT DISTINCT ON (ap.id, LOWER(ce.from_email))
  ap.id,
  c.tenant_id,
  ce.from_name,
  LOWER(ce.from_email),
  true
FROM customer_emails ce
JOIN customers c ON c.id = ce.customer_id
JOIN account_plans ap ON ap.customer_id = c.id
JOIN tenants t ON t.id = c.tenant_id
WHERE ce.from_email IS NOT NULL
  AND ce.direction = 'inbound'
  AND LOWER(split_part(ce.from_email, '@', 2)) = LOWER(t.domain)
ON CONFLICT (account_plan_id, LOWER(email)) WHERE email IS NOT NULL DO NOTHING;

-- 2B: Backfill from customer_meetings attendees
INSERT INTO account_stakeholders (account_plan_id, tenant_id, name, email, is_ai_suggested)
SELECT DISTINCT ON (ap.id, LOWER(att->>'email'))
  ap.id,
  c.tenant_id,
  COALESCE(NULLIF(att->>'name', ''), _name_from_email(att->>'email')),
  LOWER(att->>'email'),
  true
FROM customer_meetings cm
JOIN customers c ON c.id = cm.customer_id
JOIN account_plans ap ON ap.customer_id = c.id
JOIN tenants t ON t.id = c.tenant_id,
LATERAL jsonb_array_elements(cm.attendees) AS att
WHERE att->>'email' IS NOT NULL
  AND LOWER(split_part(att->>'email', '@', 2)) = LOWER(t.domain)
ON CONFLICT (account_plan_id, LOWER(email)) WHERE email IS NOT NULL DO NOTHING;

-- 2C: Backfill from email body text (regex extract emails)
INSERT INTO account_stakeholders (account_plan_id, tenant_id, name, email, is_ai_suggested)
SELECT DISTINCT ON (ap.id, LOWER(m[1]))
  ap.id,
  c.tenant_id,
  _name_from_email(m[1]),
  LOWER(m[1]),
  true
FROM customer_emails ce
JOIN customers c ON c.id = ce.customer_id
JOIN account_plans ap ON ap.customer_id = c.id
JOIN tenants t ON t.id = c.tenant_id,
LATERAL regexp_matches(ce.body_plain, '([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})', 'g') AS m
WHERE ce.body_plain IS NOT NULL
  AND LOWER(split_part(m[1], '@', 2)) = LOWER(t.domain)
  AND LOWER(split_part(m[1], '@', 2)) != 'crossnokaye.com'
ON CONFLICT (account_plan_id, LOWER(email)) WHERE email IS NOT NULL DO NOTHING;

-- Clean up helper
DROP FUNCTION IF EXISTS _name_from_email(text);
