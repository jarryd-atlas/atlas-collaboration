-- ═══════════════════════════════════════════════════════════════
-- Customer List Summary View
-- Replaces getCustomersWithAccountData() which fetched 9 entire
-- tables and aggregated in JavaScript. This does it in SQL.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW customer_list_summary AS
SELECT
  c.id,
  c.name,
  c.slug,
  t.domain,
  c.company_type,
  -- Account plan
  ap.account_stage,
  ap.total_addressable_sites,
  -- Enterprise deal
  ed.deal_name,
  ed.target_value,
  ed.deal_stage,
  ed.target_close_date,
  -- Stakeholder count
  COALESCE(sk.cnt, 0)::int AS stakeholder_count,
  -- Goals
  COALESCE(g.total, 0)::int AS goals_total,
  COALESCE(g.achieved, 0)::int AS goals_achieved,
  -- Milestones
  COALESCE(ms.total, 0)::int AS milestones_total,
  COALESCE(ms.completed, 0)::int AS milestones_completed,
  -- Tasks
  COALESCE(tk.open_tasks, 0)::int AS open_tasks,
  -- Issues
  COALESCE(iss.open_issues, 0)::int AS open_issues,
  -- Sites
  COALESCE(st.total_sites, 0)::int AS total_sites,
  COALESCE(st.active_sites, 0)::int AS active_sites,
  COALESCE(st.deploying_sites, 0)::int AS deploying_sites,
  COALESCE(st.eval_sites, 0)::int AS eval_sites
FROM customers c
LEFT JOIN tenants t ON t.id = c.tenant_id
LEFT JOIN account_plans ap ON ap.customer_id = c.id
LEFT JOIN enterprise_deals ed ON ed.customer_id = c.id
-- Stakeholder count
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS cnt
  FROM account_stakeholders
  WHERE account_plan_id = ap.id
) sk ON true
-- Goals aggregation
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE is_achieved)::int AS achieved
  FROM success_plan_goals
  WHERE account_plan_id = ap.id
) g ON true
-- Milestones aggregation
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
  FROM success_plan_milestones
  WHERE account_plan_id = ap.id
) ms ON true
-- Open tasks (by customer_id directly, or by site_id → customer)
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS open_tasks
  FROM tasks t2
  WHERE t2.status != 'done'
    AND (t2.customer_id = c.id OR t2.site_id IN (SELECT id FROM sites WHERE customer_id = c.id))
) tk ON true
-- Open issues (via sites)
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS open_issues
  FROM flagged_issues fi
  JOIN sites s ON s.id = fi.site_id
  WHERE fi.status = 'open' AND s.customer_id = c.id
) iss ON true
-- Site counts
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::int AS total_sites,
    COUNT(*) FILTER (WHERE pipeline_stage = 'active')::int AS active_sites,
    COUNT(*) FILTER (WHERE pipeline_stage = 'deployment')::int AS deploying_sites,
    COUNT(*) FILTER (WHERE pipeline_stage IN ('evaluation', 'qualified', 'prospect'))::int AS eval_sites
  FROM sites
  WHERE customer_id = c.id
) st ON true
ORDER BY c.name;
