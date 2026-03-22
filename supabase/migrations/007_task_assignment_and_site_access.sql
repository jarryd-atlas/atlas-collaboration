-- Migration 007: Task Assignment, CK Team Management & Site-Level Access Control
-- Enables cross-tenant task assignment, associates CK team members with customer accounts,
-- and adds site-level access restrictions for customer users.

-- 1. customer_team_members: Associates CK internal profiles with customer accounts
-- Controls which CK users are visible to customers for task assignment
create table customer_team_members (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  role_label  text,  -- e.g. "Account Manager", "Project Lead"
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (customer_id, profile_id)
);

create index ctm_customer_idx on customer_team_members(customer_id);
create index ctm_profile_idx on customer_team_members(profile_id);

-- 2. site_access: Restricts customer users to specific sites
-- No rows = company-level (unrestricted). One or more rows = restricted to those sites only.
create table site_access (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  site_id     uuid not null references sites(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (profile_id, site_id)
);

create index site_access_profile_idx on site_access(profile_id);
create index site_access_site_idx on site_access(site_id);

-- 3. Add created_by to tasks to track who created each task
alter table tasks add column if not exists created_by uuid references profiles(id);

-- 4. Add customer_id to tasks for company-level tasks (not tied to any site)
alter table tasks add column if not exists customer_id uuid references customers(id);
create index if not exists tasks_customer_idx on tasks(customer_id);

-- 5. RLS policies for customer_team_members
alter table customer_team_members enable row level security;

-- CK internal can see all; customer users can see their own customer's team
create policy "ctm_select" on customer_team_members for select using (
  public.is_active() and (
    public.is_internal()
    or customer_id in (
      select c.id from customers c where c.tenant_id = public.tenant_id()
    )
  )
);

create policy "ctm_insert" on customer_team_members for insert with check (
  public.is_internal() and public.app_role() in ('super_admin', 'admin')
);

create policy "ctm_update" on customer_team_members for update using (
  public.is_internal() and public.app_role() in ('super_admin', 'admin')
);

create policy "ctm_delete" on customer_team_members for delete using (
  public.is_internal() and public.app_role() in ('super_admin', 'admin')
);

-- 6. RLS policies for site_access
alter table site_access enable row level security;

create policy "site_access_select" on site_access for select using (
  public.is_active() and (
    public.is_internal()
    or profile_id = public.profile_id()
  )
);

create policy "site_access_insert" on site_access for insert with check (
  public.is_internal() and public.app_role() in ('super_admin', 'admin')
);

create policy "site_access_delete" on site_access for delete using (
  public.is_internal() and public.app_role() in ('super_admin', 'admin')
);
