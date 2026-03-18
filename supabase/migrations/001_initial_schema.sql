-- ATLAS Collaborate — Initial Schema
-- Multi-tenant customer collaboration portal for CrossnoKaye

-- ═══════════════════════════════════════════════════════════════
-- Extensions
-- ═══════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";
create extension if not exists "vector";     -- pgvector for embeddings

-- ═══════════════════════════════════════════════════════════════
-- Custom Types (Enums)
-- ═══════════════════════════════════════════════════════════════

create type tenant_type        as enum ('internal', 'customer');
create type user_role          as enum ('super_admin', 'admin', 'member');
create type profile_status     as enum ('active', 'pending', 'pending_approval', 'disabled');
create type pipeline_stage     as enum ('prospect', 'evaluation', 'qualified', 'disqualified', 'contracted', 'deployment', 'active', 'paused');
create type milestone_status   as enum ('not_started', 'in_progress', 'completed', 'on_hold');
create type task_status        as enum ('todo', 'in_progress', 'in_review', 'done');
create type priority_level     as enum ('low', 'medium', 'high', 'urgent');
create type attachment_type    as enum ('document', 'photo', 'video', 'audio');
create type entity_type        as enum ('site', 'milestone', 'task', 'report', 'issue', 'customer');
create type severity_level     as enum ('low', 'medium', 'high', 'critical');
create type issue_status       as enum ('open', 'acknowledged', 'resolved');
create type notification_type  as enum ('report_published', 'task_assigned', 'comment_mention', 'milestone_completed', 'approval_needed', 'issue_flagged');
create type voice_note_status  as enum ('uploading', 'transcribing', 'summarizing', 'ready', 'error');
create type report_status      as enum ('draft', 'generating', 'review', 'published');
create type report_cadence     as enum ('weekly', 'biweekly', 'monthly');
create type task_source        as enum ('manual', 'ai_extracted');
create type job_status         as enum ('pending', 'processing', 'completed', 'failed');

-- ═══════════════════════════════════════════════════════════════
-- Core Hierarchy
-- ═══════════════════════════════════════════════════════════════

-- Tenants: CK (internal) + each customer org
create table tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        tenant_type not null,
  domain      text,                   -- e.g. 'americold.com' for auto-association
  logo_url    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index tenants_domain_idx on tenants (domain) where domain is not null;

-- Profiles: extends auth.users with tenant + role
create table profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  tenant_id   uuid not null references tenants (id) on delete cascade,
  role        user_role not null default 'member',
  status      profile_status not null default 'pending',
  full_name   text,
  avatar_url  text,
  email       text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (user_id)
);

create index profiles_tenant_idx on profiles (tenant_id);
create index profiles_email_idx on profiles (email);

-- Customers: account details, linked to a customer tenant
create table customers (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants (id) on delete cascade,
  name        text not null,
  slug        text not null unique,
  logo_url    text,
  metadata    jsonb default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index customers_tenant_idx on customers (tenant_id);

-- Sites: physical facilities within a customer
create table sites (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references customers (id) on delete cascade,
  tenant_id       uuid not null references tenants (id) on delete cascade,
  name            text not null,
  slug            text not null,
  address         text,
  city            text,
  state           text,
  pipeline_stage  pipeline_stage not null default 'prospect',
  dq_reason       text,
  dq_reeval_date  date,
  metadata        jsonb default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Full-text search
  search_vector   tsvector generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(city, '') || ' ' || coalesce(state, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(address, '')), 'C')
  ) stored,

  unique (customer_id, slug)
);

create index sites_customer_idx on sites (customer_id);
create index sites_tenant_idx on sites (tenant_id);
create index sites_pipeline_idx on sites (pipeline_stage);
create index sites_search_idx on sites using gin (search_vector);

-- Milestone templates: standardized ATLAS lifecycle + custom
create table milestone_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  sort_order  integer not null default 0,
  is_default  boolean not null default false,  -- ATLAS lifecycle templates
  created_at  timestamptz not null default now()
);

-- Milestones: within a site
create table milestones (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references sites (id) on delete cascade,
  tenant_id     uuid not null references tenants (id) on delete cascade,
  template_id   uuid references milestone_templates (id),
  name          text not null,
  slug          text not null,
  description   text,
  status        milestone_status not null default 'not_started',
  priority      priority_level not null default 'medium',
  progress      integer not null default 0 check (progress >= 0 and progress <= 100),
  start_date    date,
  due_date      date,
  sort_order    integer not null default 0,
  completed_at  timestamptz,
  metadata      jsonb default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored,

  unique (site_id, slug)
);

create index milestones_site_idx on milestones (site_id);
create index milestones_tenant_idx on milestones (tenant_id);
create index milestones_status_idx on milestones (status);
create index milestones_due_date_idx on milestones (due_date) where due_date is not null;
create index milestones_search_idx on milestones using gin (search_vector);

-- Tasks: within a milestone
create table tasks (
  id            uuid primary key default gen_random_uuid(),
  milestone_id  uuid not null references milestones (id) on delete cascade,
  tenant_id     uuid not null references tenants (id) on delete cascade,
  title         text not null,
  description   text,
  status        task_status not null default 'todo',
  priority      priority_level not null default 'medium',
  assignee_id   uuid references profiles (id),
  due_date      date,
  sort_order    integer not null default 0,
  source        task_source not null default 'manual',
  metadata      jsonb default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored
);

create index tasks_milestone_idx on tasks (milestone_id);
create index tasks_tenant_idx on tasks (tenant_id);
create index tasks_assignee_idx on tasks (assignee_id);
create index tasks_status_idx on tasks (status);
create index tasks_due_date_idx on tasks (due_date) where due_date is not null;
create index tasks_search_idx on tasks using gin (search_vector);

-- ═══════════════════════════════════════════════════════════════
-- Collaboration
-- ═══════════════════════════════════════════════════════════════

-- Comments: polymorphic, attached to site/milestone/task
create table comments (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants (id) on delete cascade,
  entity_type   entity_type not null,
  entity_id     uuid not null,
  author_id     uuid not null references profiles (id),
  body          text not null,
  mentions      uuid[] default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  search_vector tsvector generated always as (
    to_tsvector('english', coalesce(body, ''))
  ) stored
);

create index comments_entity_idx on comments (entity_type, entity_id);
create index comments_tenant_idx on comments (tenant_id);
create index comments_author_idx on comments (author_id);
create index comments_search_idx on comments using gin (search_vector);

-- Notifications
create table notifications (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants (id) on delete cascade,
  user_id       uuid not null references profiles (id) on delete cascade,
  type          notification_type not null,
  entity_type   entity_type,
  entity_id     uuid,
  title         text not null,
  body          text,
  read_at       timestamptz,
  email_sent_at timestamptz,
  created_at    timestamptz not null default now()
);

create index notifications_user_idx on notifications (user_id, read_at nulls first);
create index notifications_tenant_idx on notifications (tenant_id);

-- Flagged issues
create table flagged_issues (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants (id) on delete cascade,
  site_id       uuid not null references sites (id) on delete cascade,
  severity      severity_level not null,
  summary       text not null,
  details       text,
  status        issue_status not null default 'open',
  flagged_by    uuid not null references profiles (id),
  resolved_by   uuid references profiles (id),
  resolved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index flagged_issues_site_idx on flagged_issues (site_id);
create index flagged_issues_tenant_idx on flagged_issues (tenant_id);
create index flagged_issues_status_idx on flagged_issues (status);

-- ═══════════════════════════════════════════════════════════════
-- Voice & Documents
-- ═══════════════════════════════════════════════════════════════

-- Voice notes
create table voice_notes (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants (id) on delete cascade,
  site_id       uuid references sites (id) on delete set null,
  milestone_id  uuid references milestones (id) on delete set null,
  recorded_by   uuid not null references profiles (id),
  title         text,
  file_path     text not null,
  duration_sec  integer,
  status        voice_note_status not null default 'uploading',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index voice_notes_tenant_idx on voice_notes (tenant_id);
create index voice_notes_site_idx on voice_notes (site_id);
create index voice_notes_recorded_by_idx on voice_notes (recorded_by);

-- Transcriptions: linked to voice notes
create table transcriptions (
  id              uuid primary key default gen_random_uuid(),
  voice_note_id   uuid not null references voice_notes (id) on delete cascade,
  tenant_id       uuid not null references tenants (id) on delete cascade,
  raw_text        text not null,
  summary         text,
  extracted_tasks jsonb default '[]',     -- [{title, description, priority, assignee_hint}]
  extracted_decisions jsonb default '[]', -- [{decision, context}]
  extracted_updates   jsonb default '[]', -- [{update, entity_hint}]
  created_at      timestamptz not null default now()
);

create index transcriptions_voice_note_idx on transcriptions (voice_note_id);

-- Attachments: polymorphic media table (documents, photos, videos, audio)
create table attachments (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants (id) on delete cascade,
  entity_type   entity_type not null,
  entity_id     uuid not null,
  type          attachment_type not null,
  file_name     text not null,
  file_path     text not null,
  file_size     bigint,
  mime_type     text,
  uploaded_by   uuid not null references profiles (id),
  metadata      jsonb default '{}',
  created_at    timestamptz not null default now(),

  search_vector tsvector generated always as (
    to_tsvector('english', coalesce(file_name, ''))
  ) stored
);

create index attachments_entity_idx on attachments (entity_type, entity_id);
create index attachments_tenant_idx on attachments (tenant_id);
create index attachments_type_idx on attachments (type);
create index attachments_search_idx on attachments using gin (search_vector);

-- Document chunks: for RAG search via pgvector
create table document_chunks (
  id              uuid primary key default gen_random_uuid(),
  attachment_id   uuid not null references attachments (id) on delete cascade,
  tenant_id       uuid not null references tenants (id) on delete cascade,
  chunk_index     integer not null,
  content         text not null,
  embedding       vector(1536),           -- text-embedding-3-small dimension
  token_count     integer,
  created_at      timestamptz not null default now()
);

create index document_chunks_attachment_idx on document_chunks (attachment_id);
create index document_chunks_tenant_idx on document_chunks (tenant_id);
create index document_chunks_embedding_idx on document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ═══════════════════════════════════════════════════════════════
-- Reports
-- ═══════════════════════════════════════════════════════════════

create table status_reports (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants (id) on delete cascade,
  customer_id   uuid not null references customers (id) on delete cascade,
  site_id       uuid references sites (id) on delete set null,  -- null = portfolio report
  slug          uuid not null default gen_random_uuid(),         -- public URL slug
  title         text not null,
  status        report_status not null default 'draft',
  date_from     date,
  date_to       date,
  created_by    uuid not null references profiles (id),
  published_at  timestamptz,
  metadata      jsonb default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (slug)
);

create index reports_tenant_idx on status_reports (tenant_id);
create index reports_customer_idx on status_reports (customer_id);
create index reports_site_idx on status_reports (site_id);

create table report_sections (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references status_reports (id) on delete cascade,
  tenant_id   uuid not null references tenants (id) on delete cascade,
  section_key text not null,            -- e.g. 'executive_summary', 'milestone_progress'
  title       text not null,
  content     text not null default '',
  sort_order  integer not null default 0,
  metadata    jsonb default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index report_sections_report_idx on report_sections (report_id, sort_order);
create index report_sections_tenant_idx on report_sections (tenant_id);

create table report_schedules (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants (id) on delete cascade,
  customer_id   uuid not null references customers (id) on delete cascade,
  site_id       uuid references sites (id) on delete set null,
  cadence       report_cadence not null default 'weekly',
  recipients    text[] not null default '{}',   -- email addresses
  next_run_at   timestamptz not null,
  last_run_at   timestamptz,
  is_active     boolean not null default true,
  created_by    uuid not null references profiles (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index report_schedules_next_run_idx on report_schedules (next_run_at) where is_active = true;

-- ═══════════════════════════════════════════════════════════════
-- System
-- ═══════════════════════════════════════════════════════════════

-- Activity log
create table activity_log (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants (id) on delete cascade,
  actor_id      uuid references profiles (id),
  entity_type   entity_type not null,
  entity_id     uuid not null,
  action        text not null,            -- e.g. 'created', 'updated', 'status_changed'
  changes       jsonb default '{}',       -- {field: {old, new}}
  created_at    timestamptz not null default now()
);

create index activity_log_entity_idx on activity_log (entity_type, entity_id);
create index activity_log_tenant_idx on activity_log (tenant_id);
create index activity_log_created_idx on activity_log (created_at desc);

-- Job queue: background worker processing
create table job_queue (
  id            uuid primary key default gen_random_uuid(),
  type          text not null,           -- job type: transcribe, summarize, etc.
  payload       jsonb not null default '{}',
  status        job_status not null default 'pending',
  attempts      integer not null default 0,
  max_attempts  integer not null default 3,
  error         text,
  locked_at     timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index job_queue_pending_idx on job_queue (created_at) where status = 'pending';
create index job_queue_type_idx on job_queue (type, status);

-- ═══════════════════════════════════════════════════════════════
-- Search view: union across all searchable entities
-- ═══════════════════════════════════════════════════════════════

create or replace view search_all_v as
  select id, tenant_id, 'site'::entity_type as entity_type, name as title, search_vector
  from sites
  union all
  select id, tenant_id, 'milestone'::entity_type, name, search_vector
  from milestones
  union all
  select id, tenant_id, 'task'::entity_type, title, search_vector
  from tasks;

-- ═══════════════════════════════════════════════════════════════
-- Triggers: auto-update updated_at
-- ═══════════════════════════════════════════════════════════════

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply updated_at trigger to all tables with that column
do $$
declare
  t text;
begin
  for t in
    select table_name from information_schema.columns
    where column_name = 'updated_at'
      and table_schema = 'public'
      and table_name not in ('search_all_v')
  loop
    execute format(
      'create trigger set_updated_at before update on %I for each row execute function update_updated_at()',
      t
    );
  end loop;
end;
$$;

-- ═══════════════════════════════════════════════════════════════
-- Seed: default ATLAS milestone templates
-- ═══════════════════════════════════════════════════════════════

insert into milestone_templates (name, description, sort_order, is_default) values
  ('Assessment',    'Initial site assessment and requirements gathering', 1, true),
  ('Installation',  'Hardware and sensor installation',                   2, true),
  ('Calibration',   'System calibration and configuration',               3, true),
  ('Go-Live',       'Production deployment and handoff',                  4, true),
  ('Optimization',  'Ongoing optimization and performance tuning',        5, true);

-- ═══════════════════════════════════════════════════════════════
-- Seed: CK internal tenant
-- ═══════════════════════════════════════════════════════════════

insert into tenants (id, name, type, domain) values
  ('00000000-0000-0000-0000-000000000001', 'CrossnoKaye', 'internal', 'crossnokaye.com');
