-- ATLAS Collaborate — Row Level Security Policies
-- Multi-tenancy: customers see own data, CK internal sees all
--
-- DESIGN: Most writes go through server actions using the service role
-- (bypasses RLS). These policies are defense-in-depth for any
-- client-side mutations (comments, attachments, notifications).

-- ═══════════════════════════════════════════════════════════════
-- Helper functions: extract custom claims from JWT
-- NOTE: Custom claims use "app_" prefix to avoid collision with
-- Supabase's built-in JWT fields (especially 'role')
-- ═══════════════════════════════════════════════════════════════

create or replace function public.tenant_id()
returns uuid
language sql
stable
as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid,
    null
  )
$$;

create or replace function public.tenant_type()
returns text
language sql
stable
as $$
  select coalesce(
    current_setting('request.jwt.claims', true)::json->>'tenant_type',
    ''
  )
$$;

create or replace function public.app_role()
returns text
language sql
stable
as $$
  select coalesce(
    current_setting('request.jwt.claims', true)::json->>'app_role',
    ''
  )
$$;

create or replace function public.profile_id()
returns uuid
language sql
stable
as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::json->>'profile_id')::uuid,
    null
  )
$$;

create or replace function public.profile_status()
returns text
language sql
stable
as $$
  select coalesce(
    current_setting('request.jwt.claims', true)::json->>'profile_status',
    ''
  )
$$;

-- Convenience: is user active?
create or replace function public.is_active()
returns boolean
language sql
stable
as $$
  select public.profile_status() = 'active'
$$;

-- Convenience: is user CK internal?
create or replace function public.is_internal()
returns boolean
language sql
stable
as $$
  select public.tenant_type() = 'internal' and public.is_active()
$$;

-- Convenience: standard tenant check (CK sees all, customer sees own)
create or replace function public.can_read_tenant(row_tenant_id uuid)
returns boolean
language sql
stable
as $$
  select public.is_active() and (public.is_internal() or row_tenant_id = public.tenant_id())
$$;

-- Grant execute to authenticated role
grant execute on function public.tenant_id to authenticated;
grant execute on function public.tenant_type to authenticated;
grant execute on function public.app_role to authenticated;
grant execute on function public.profile_id to authenticated;
grant execute on function public.profile_status to authenticated;
grant execute on function public.is_active to authenticated;
grant execute on function public.is_internal to authenticated;
grant execute on function public.can_read_tenant to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- Enable RLS on all tables
-- ═══════════════════════════════════════════════════════════════

alter table tenants enable row level security;
alter table profiles enable row level security;
alter table customers enable row level security;
alter table sites enable row level security;
alter table milestone_templates enable row level security;
alter table milestones enable row level security;
alter table tasks enable row level security;
alter table comments enable row level security;
alter table notifications enable row level security;
alter table flagged_issues enable row level security;
alter table voice_notes enable row level security;
alter table transcriptions enable row level security;
alter table attachments enable row level security;
alter table document_chunks enable row level security;
alter table status_reports enable row level security;
alter table report_sections enable row level security;
alter table report_schedules enable row level security;
alter table activity_log enable row level security;
alter table job_queue enable row level security;

-- ═══════════════════════════════════════════════════════════════
-- SELECT Policies
-- Pattern: active users only; CK sees all, customer sees own tenant
-- ═══════════════════════════════════════════════════════════════

-- ─── Tenants ─────────────────────────────────────────────────

create policy "tenants_select" on tenants for select using (
  public.is_active() and (public.is_internal() or id = public.tenant_id())
);

-- ─── Profiles ────────────────────────────────────────────────

create policy "profiles_select" on profiles for select using (
  public.can_read_tenant(tenant_id)
);

-- Users can update ONLY their own display fields (name, avatar)
-- Cannot change role, status, or tenant_id
create policy "profiles_update_own" on profiles for update
  using (user_id = auth.uid() and public.is_active())
  with check (
    -- Prevent escalation: role, status, tenant_id must stay unchanged
    role = (select p.role from profiles p where p.user_id = auth.uid())
    and status = (select p.status from profiles p where p.user_id = auth.uid())
    and tenant_id = (select p.tenant_id from profiles p where p.user_id = auth.uid())
  );

-- ─── Customers ───────────────────────────────────────────────

create policy "customers_select" on customers for select using (
  public.can_read_tenant(tenant_id)
);

-- CK internal can insert/update customers
create policy "customers_insert" on customers for insert with check (
  public.is_internal()
);

create policy "customers_update" on customers for update using (
  public.is_internal()
);

-- ─── Sites ───────────────────────────────────────────────────

create policy "sites_select" on sites for select using (
  public.can_read_tenant(tenant_id)
);

create policy "sites_insert" on sites for insert with check (
  public.is_internal()
);

create policy "sites_update" on sites for update using (
  public.is_internal()
);

create policy "sites_delete" on sites for delete using (
  public.is_internal() and public.app_role() in ('super_admin', 'admin')
);

-- ─── Milestone Templates ────────────────────────────────────

-- Readable by all active authenticated users
create policy "milestone_templates_select" on milestone_templates for select using (
  public.is_active()
);

-- ─── Milestones ──────────────────────────────────────────────

create policy "milestones_select" on milestones for select using (
  public.can_read_tenant(tenant_id)
);

create policy "milestones_insert" on milestones for insert with check (
  public.is_internal()
);

create policy "milestones_update" on milestones for update using (
  public.is_internal()
);

create policy "milestones_delete" on milestones for delete using (
  public.is_internal() and public.app_role() in ('super_admin', 'admin')
);

-- ─── Tasks ───────────────────────────────────────────────────

create policy "tasks_select" on tasks for select using (
  public.can_read_tenant(tenant_id)
);

create policy "tasks_insert" on tasks for insert with check (
  public.is_internal()
);

create policy "tasks_update" on tasks for update using (
  public.is_internal()
);

create policy "tasks_delete" on tasks for delete using (
  public.is_internal()
);

-- ─── Comments ────────────────────────────────────────────────

create policy "comments_select" on comments for select using (
  public.can_read_tenant(tenant_id)
);

-- All active users can insert comments, but must use their own profile_id
-- and their own tenant_id (CK users set tenant_id to the customer's tenant)
create policy "comments_insert" on comments for insert with check (
  public.is_active()
  and author_id = public.profile_id()
);

create policy "comments_update_own" on comments for update using (
  author_id = public.profile_id() and public.is_active()
);

create policy "comments_delete_own" on comments for delete using (
  author_id = public.profile_id() and public.is_active()
);

-- ─── Notifications ───────────────────────────────────────────

-- Users see only their own notifications
create policy "notifications_select" on notifications for select using (
  user_id = public.profile_id() and public.is_active()
);

-- Users can mark their own notifications as read
create policy "notifications_update_own" on notifications for update using (
  user_id = public.profile_id() and public.is_active()
);

-- ─── Flagged Issues ──────────────────────────────────────────

create policy "flagged_issues_select" on flagged_issues for select using (
  public.can_read_tenant(tenant_id)
);

-- Only CK users can create/update flagged issues
create policy "flagged_issues_insert" on flagged_issues for insert with check (
  public.is_internal() and flagged_by = public.profile_id()
);

create policy "flagged_issues_update" on flagged_issues for update using (
  public.is_internal()
);

-- ─── Voice Notes ─────────────────────────────────────────────

-- CK only — customers cannot see or create voice notes
create policy "voice_notes_select" on voice_notes for select using (
  public.is_internal()
);

create policy "voice_notes_insert" on voice_notes for insert with check (
  public.is_internal() and recorded_by = public.profile_id()
);

-- ─── Transcriptions ──────────────────────────────────────────

create policy "transcriptions_select" on transcriptions for select using (
  public.is_internal()
);

-- ─── Attachments ─────────────────────────────────────────────

create policy "attachments_select" on attachments for select using (
  public.can_read_tenant(tenant_id)
);

-- All active users can upload, must use their own profile_id
create policy "attachments_insert" on attachments for insert with check (
  public.is_active() and uploaded_by = public.profile_id()
);

create policy "attachments_delete" on attachments for delete using (
  uploaded_by = public.profile_id() and public.is_active()
);

-- ─── Document Chunks ─────────────────────────────────────────

create policy "document_chunks_select" on document_chunks for select using (
  public.can_read_tenant(tenant_id)
);

-- ─── Status Reports ──────────────────────────────────────────

create policy "status_reports_select" on status_reports for select using (
  public.can_read_tenant(tenant_id)
);

create policy "status_reports_insert" on status_reports for insert with check (
  public.is_internal()
);

create policy "status_reports_update" on status_reports for update using (
  public.is_internal()
);

-- ─── Report Sections ─────────────────────────────────────────

-- Uses denormalized tenant_id (added to table in schema fix)
create policy "report_sections_select" on report_sections for select using (
  public.can_read_tenant(tenant_id)
);

create policy "report_sections_insert" on report_sections for insert with check (
  public.is_internal()
);

create policy "report_sections_update" on report_sections for update using (
  public.is_internal()
);

-- ─── Report Schedules ────────────────────────────────────────

create policy "report_schedules_select" on report_schedules for select using (
  public.is_internal()
);

create policy "report_schedules_insert" on report_schedules for insert with check (
  public.is_internal()
);

create policy "report_schedules_update" on report_schedules for update using (
  public.is_internal()
);

-- ─── Activity Log ────────────────────────────────────────────

create policy "activity_log_select" on activity_log for select using (
  public.can_read_tenant(tenant_id)
);

-- ─── Job Queue ───────────────────────────────────────────────

-- Accessed via service role by worker only; super_admin can view for debugging
create policy "job_queue_select" on job_queue for select using (
  public.is_internal() and public.app_role() = 'super_admin'
);

-- ═══════════════════════════════════════════════════════════════
-- Public report access (no auth) via slug lookup
-- Handled by the service role in the report page server component,
-- bypassing RLS entirely. No anon policy needed.
-- ═══════════════════════════════════════════════════════════════
