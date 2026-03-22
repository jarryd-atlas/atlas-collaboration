-- ATLAS Collaborate — Baseline Tab, Labor Section, AI Document Extraction
-- Consolidates assessment tabs, adds labor tracking, enables AI-powered document analysis

-- ═══════════════════════════════════════════════════════════════
-- TOU Schedule — Static rate schedule (one per assessment)
-- Separates provider/rate info from monthly consumption data
-- ═══════════════════════════════════════════════════════════════

create table site_tou_schedule (
  id                        uuid primary key default gen_random_uuid(),
  assessment_id             uuid not null references site_assessments(id) on delete cascade,
  site_id                   uuid not null references sites(id) on delete cascade,
  tenant_id                 uuid not null references tenants(id) on delete cascade,
  -- Providers
  supply_provider           text,
  distribution_provider     text,
  -- On-Peak
  on_peak_energy_rate       numeric,   -- $/kWh
  on_peak_demand_rate       numeric,   -- $/kW
  on_peak_start_hour        integer,   -- 0-23
  on_peak_end_hour          integer,   -- 0-23
  on_peak_months            text,      -- e.g. 'Jun-Sep'
  -- Off-Peak
  off_peak_energy_rate      numeric,
  off_peak_demand_rate      numeric,
  -- Shoulder
  shoulder_energy_rate      numeric,
  shoulder_demand_rate      numeric,
  shoulder_start_hour       integer,
  shoulder_end_hour         integer,
  shoulder_months           text,
  -- Super-Peak (optional)
  super_peak_energy_rate    numeric,
  super_peak_demand_rate    numeric,
  super_peak_start_hour     integer,
  super_peak_end_hour       integer,
  super_peak_months         text,
  -- Metadata
  notes                     text,
  source_document_id        uuid references attachments(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique(assessment_id)
);

create index site_tou_schedule_site_idx on site_tou_schedule(site_id);
create index site_tou_schedule_tenant_idx on site_tou_schedule(tenant_id);

-- ═══════════════════════════════════════════════════════════════
-- Labor Baseline — Staffing data for labor impact tracking
-- ═══════════════════════════════════════════════════════════════

create table site_labor_baseline (
  id                        uuid primary key default gen_random_uuid(),
  assessment_id             uuid not null references site_assessments(id) on delete cascade,
  site_id                   uuid not null references sites(id) on delete cascade,
  tenant_id                 uuid not null references tenants(id) on delete cascade,
  -- Structured headcount: [{role, count, hours_per_week, hourly_rate}]
  headcount                 jsonb default '[]',
  total_manual_hours_week   numeric,
  annual_contractor_cost    numeric,
  -- Qualitative
  pain_points               text,
  manual_processes          text,
  time_sinks                text,
  automation_opportunities  text,
  notes                     text,
  -- Source tracking
  source_document_id        uuid references attachments(id) on delete set null,
  metadata                  jsonb default '{}',
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique(assessment_id)
);

create index site_labor_baseline_site_idx on site_labor_baseline(site_id);
create index site_labor_baseline_tenant_idx on site_labor_baseline(tenant_id);

-- ═══════════════════════════════════════════════════════════════
-- Baseline Data Sources — AI source attribution (document → field)
-- ═══════════════════════════════════════════════════════════════

create table baseline_data_sources (
  id                uuid primary key default gen_random_uuid(),
  assessment_id     uuid not null references site_assessments(id) on delete cascade,
  site_id           uuid not null references sites(id) on delete cascade,
  tenant_id         uuid not null references tenants(id) on delete cascade,
  attachment_id     uuid not null references attachments(id) on delete cascade,
  extraction_id     uuid references document_extractions(id) on delete set null,
  target_table      text not null,     -- e.g. 'site_equipment', 'site_energy_data'
  target_record_id  uuid,              -- specific row id (null = general attribution)
  target_field      text,              -- specific column (null = whole record)
  confidence        numeric,
  created_at        timestamptz not null default now()
);

create index bds_assessment_idx on baseline_data_sources(assessment_id);
create index bds_attachment_idx on baseline_data_sources(attachment_id);
create index bds_target_idx on baseline_data_sources(target_table, target_record_id);

-- ═══════════════════════════════════════════════════════════════
-- Add assessment_id to document_extractions
-- ═══════════════════════════════════════════════════════════════

alter table document_extractions
  add column if not exists assessment_id uuid references site_assessments(id) on delete set null;

-- ═══════════════════════════════════════════════════════════════
-- Add source_document_id to existing assessment tables
-- ═══════════════════════════════════════════════════════════════

alter table site_equipment
  add column if not exists source_document_id uuid references attachments(id) on delete set null;

alter table site_energy_data
  add column if not exists source_document_id uuid references attachments(id) on delete set null;

alter table site_operational_params
  add column if not exists source_document_id uuid references attachments(id) on delete set null;

alter table site_operations
  add column if not exists source_document_id uuid references attachments(id) on delete set null;

alter table site_rate_structure
  add column if not exists source_document_id uuid references attachments(id) on delete set null;

alter table site_load_breakdown
  add column if not exists source_document_id uuid references attachments(id) on delete set null;

alter table site_savings_analysis
  add column if not exists source_document_id uuid references attachments(id) on delete set null;

-- ═══════════════════════════════════════════════════════════════
-- Add TOU consumption columns to site_energy_data
-- ═══════════════════════════════════════════════════════════════

alter table site_energy_data
  add column if not exists on_peak_kwh numeric,
  add column if not exists off_peak_kwh numeric,
  add column if not exists shoulder_kwh numeric,
  add column if not exists super_peak_kwh numeric,
  add column if not exists on_peak_demand_kw numeric,
  add column if not exists off_peak_demand_kw numeric;

-- ═══════════════════════════════════════════════════════════════
-- Updated_at triggers for new tables
-- ═══════════════════════════════════════════════════════════════

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'site_tou_schedule', 'site_labor_baseline'
    ])
  loop
    execute format(
      'create trigger set_updated_at before update on %I for each row execute function update_updated_at()',
      t
    );
  end loop;
end;
$$;

-- ═══════════════════════════════════════════════════════════════
-- RLS Policies
-- ═══════════════════════════════════════════════════════════════

alter table site_tou_schedule enable row level security;
alter table site_labor_baseline enable row level security;
alter table baseline_data_sources enable row level security;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'site_tou_schedule', 'site_labor_baseline', 'baseline_data_sources'
    ])
  loop
    execute format('create policy %I on %I for select using (public.can_read_tenant(tenant_id))', t || '_select', t);
    execute format('create policy %I on %I for insert with check (public.is_internal())', t || '_insert', t);
    execute format('create policy %I on %I for update using (public.is_internal())', t || '_update', t);
    execute format('create policy %I on %I for delete using (public.is_internal())', t || '_delete', t);
  end loop;
end;
$$;
