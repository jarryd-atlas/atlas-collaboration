-- ATLAS Collaborate — Site Assessment & Data Collection
-- Structured site evaluation for refrigeration load analysis and savings estimation

-- ═══════════════════════════════════════════════════════════════
-- New Enums
-- ═══════════════════════════════════════════════════════════════

create type equipment_category as enum (
  'compressor', 'condenser', 'evaporator', 'vessel', 'vfd', 'pump', 'controls', 'other'
);

create type assessment_status as enum ('draft', 'in_progress', 'complete', 'locked');
create type extraction_status as enum ('pending', 'extracting', 'review', 'accepted', 'rejected');

-- Add 'assessment' to entity_type for comments/activity log
alter type entity_type add value 'assessment';

-- ═══════════════════════════════════════════════════════════════
-- Site Assessments — One per site, living doc until locked
-- ═══════════════════════════════════════════════════════════════

create table site_assessments (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references sites(id) on delete cascade,
  tenant_id     uuid not null references tenants(id) on delete cascade,
  status        assessment_status not null default 'draft',
  assessed_by   uuid references profiles(id),
  assessed_at   date,
  locked_by     uuid references profiles(id),
  locked_at     timestamptz,
  notes         text,
  metadata      jsonb default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(site_id)
);

create index site_assessments_site_idx on site_assessments(site_id);
create index site_assessments_tenant_idx on site_assessments(tenant_id);

-- ═══════════════════════════════════════════════════════════════
-- Operational Parameters — System config and hours
-- ═══════════════════════════════════════════════════════════════

create table site_operational_params (
  id                      uuid primary key default gen_random_uuid(),
  assessment_id           uuid not null references site_assessments(id) on delete cascade,
  site_id                 uuid not null references sites(id) on delete cascade,
  tenant_id               uuid not null references tenants(id) on delete cascade,
  -- Operating hours
  operating_days_per_week numeric,
  daily_operational_hours numeric,
  annual_operational_hours numeric,
  load_factor             numeric default 1.0,
  off_ops_energy_use      numeric default 0.5,
  -- System info
  system_type             text,        -- 'single stage', 'two stage'
  refrigerant             text,        -- 'ammonia', 'R-22', etc.
  control_system          text,        -- 'Frick', 'Logix', etc.
  control_hardware        text,        -- 'Opto 22', 'Allen Bradley'
  micro_panel_type        text,        -- 'Quantum HD'
  has_sub_metering        boolean default false,
  facility_type           text,        -- 'cold storage', 'processing', 'distribution'
  runs_24_7               boolean default true,
  has_blast_freezing      boolean default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique(assessment_id)
);

create index site_ops_params_site_idx on site_operational_params(site_id);

-- ═══════════════════════════════════════════════════════════════
-- Equipment Inventory — Compressors, condensers, evaporators, etc.
-- ═══════════════════════════════════════════════════════════════

create table site_equipment (
  id              uuid primary key default gen_random_uuid(),
  assessment_id   uuid not null references site_assessments(id) on delete cascade,
  site_id         uuid not null references sites(id) on delete cascade,
  tenant_id       uuid not null references tenants(id) on delete cascade,
  category        equipment_category not null,
  name            text,              -- e.g. 'C-1', 'Cond #1'
  manufacturer    text,
  model           text,
  quantity        integer not null default 1,
  specs           jsonb not null default '{}',
  notes           text,
  sort_order      integer not null default 0,
  contributed_by  uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index site_equipment_assessment_idx on site_equipment(assessment_id);
create index site_equipment_site_idx on site_equipment(site_id);
create index site_equipment_category_idx on site_equipment(category);

-- ═══════════════════════════════════════════════════════════════
-- Energy Data — Monthly utility billing records
-- ═══════════════════════════════════════════════════════════════

create table site_energy_data (
  id                        uuid primary key default gen_random_uuid(),
  assessment_id             uuid not null references site_assessments(id) on delete cascade,
  site_id                   uuid not null references sites(id) on delete cascade,
  tenant_id                 uuid not null references tenants(id) on delete cascade,
  period_month              date not null,
  -- Totals
  total_charges             numeric,
  total_kwh                 numeric,
  peak_demand_kw            numeric,
  -- Supply provider (e.g. Constellation)
  supply_provider           text,
  supply_charges            numeric,
  supply_kwh_rate           numeric,
  supply_capacity           numeric,
  supply_cap_rate           numeric,
  supply_transmission       numeric,
  supply_trans_rate         numeric,
  -- Distribution provider (e.g. Delmarva Power)
  distribution_provider     text,
  distribution_charges      numeric,
  distribution_demand_rate  numeric,
  distribution_energy_rate  numeric,
  capacity_plc_kw           numeric,
  transmission_plc_kw       numeric,
  sales_tax                 numeric,
  -- Metadata
  source                    text default 'manual',
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique(assessment_id, period_month)
);

create index site_energy_data_site_idx on site_energy_data(site_id);
create index site_energy_data_period_idx on site_energy_data(period_month);

-- ═══════════════════════════════════════════════════════════════
-- Rate Structure — Utility rate breakdown percentages
-- ═══════════════════════════════════════════════════════════════

create table site_rate_structure (
  id                          uuid primary key default gen_random_uuid(),
  assessment_id               uuid not null references site_assessments(id) on delete cascade,
  site_id                     uuid not null references sites(id) on delete cascade,
  tenant_id                   uuid not null references tenants(id) on delete cascade,
  fixed_usage_pct             numeric,
  variable_tou_usage_pct      numeric,
  max_demand_pct              numeric,
  variable_tou_demand_pct     numeric,
  coincident_peak_pct         numeric,
  other_fixed_pct             numeric,
  cp_zone                     text,          -- e.g. 'PJM_DPL'
  avg_cp_tag_kw               numeric,
  capacity_rate_per_kw_yr     numeric,
  transmission_rate_per_kw_yr numeric,
  utility_provider_supply     text,
  utility_provider_distribution text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique(assessment_id)
);

create index site_rate_structure_site_idx on site_rate_structure(site_id);

-- ═══════════════════════════════════════════════════════════════
-- Operations — Constraints, commitments, and context
-- ═══════════════════════════════════════════════════════════════

create table site_operations (
  id                          uuid primary key default gen_random_uuid(),
  assessment_id               uuid not null references site_assessments(id) on delete cascade,
  site_id                     uuid not null references sites(id) on delete cascade,
  tenant_id                   uuid not null references tenants(id) on delete cascade,
  zone_commitments            jsonb default '[]',
  discharge_pressure_typical  numeric,
  suction_pressure_typical    numeric,
  can_shed_load               boolean,
  can_shutdown                boolean,
  shutdown_constraints        text,
  curtailment_enrolled        boolean,
  curtailment_frequency       text,
  curtailment_barriers        text,
  seasonality_notes           text,
  temperature_challenges      text,
  operational_nuances         text,
  product_notes               text,
  customer_mix                text,
  staffing_notes              text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique(assessment_id)
);

create index site_operations_site_idx on site_operations(site_id);

-- ═══════════════════════════════════════════════════════════════
-- Load Breakdown — Refrigeration load by subsystem
-- ═══════════════════════════════════════════════════════════════

create table site_load_breakdown (
  id                      uuid primary key default gen_random_uuid(),
  assessment_id           uuid not null references site_assessments(id) on delete cascade,
  site_id                 uuid not null references sites(id) on delete cascade,
  tenant_id               uuid not null references tenants(id) on delete cascade,
  total_refrig_kw         numeric,
  total_refrig_kwh        numeric,
  low_compressor_kw       numeric,
  low_compressor_kwh      numeric,
  high_compressor_kw      numeric,
  high_compressor_kwh     numeric,
  sheddable_evaporator_kw numeric,
  sheddable_evaporator_kwh numeric,
  condenser_kw            numeric,
  condenser_kwh           numeric,
  blast_kw                numeric,
  blast_kwh               numeric,
  pct_kw_demand           numeric,
  pct_kwh_usage           numeric,
  pct_of_building         numeric,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique(assessment_id)
);

create index site_load_breakdown_site_idx on site_load_breakdown(site_id);

-- ═══════════════════════════════════════════════════════════════
-- ARCO Performance — Pre/Post Atlas refrigeration optimization
-- ═══════════════════════════════════════════════════════════════

create table site_arco_performance (
  id                      uuid primary key default gen_random_uuid(),
  assessment_id           uuid not null references site_assessments(id) on delete cascade,
  site_id                 uuid not null references sites(id) on delete cascade,
  tenant_id               uuid not null references tenants(id) on delete cascade,
  pre_atlas               jsonb default '{}',
  post_atlas              jsonb default '{}',
  pre_atlas_kw_per_tr     numeric,
  post_atlas_kw_per_tr    numeric,
  compressor_savings_pct  numeric,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique(assessment_id)
);

create index site_arco_site_idx on site_arco_performance(site_id);

-- ═══════════════════════════════════════════════════════════════
-- Savings Analysis — Full savings model
-- ═══════════════════════════════════════════════════════════════

create table site_savings_analysis (
  id                                    uuid primary key default gen_random_uuid(),
  assessment_id                         uuid not null references site_assessments(id) on delete cascade,
  site_id                               uuid not null references sites(id) on delete cascade,
  tenant_id                             uuid not null references tenants(id) on delete cascade,
  -- Site parameters
  annual_energy_spend                   numeric,
  pre_atlas_annual_kwh                  numeric,
  avg_peak_demand_kw                    numeric,
  pct_compressor_load                   numeric,
  pct_refrigeration_load                numeric,
  pct_ref_flexible_demand_stabilization numeric,
  pct_ref_flexible_partial_shutdown     numeric,
  pct_blast                             numeric,
  -- ARCO performance params
  arco_compressor_reduction_pct         numeric,
  max_demand_smoothing_pct              numeric,
  -- Results
  opportunities                         jsonb default '[]',
  pre_atlas_annual_cost                 numeric,
  post_atlas_annual_cost                numeric,
  total_estimated_savings               numeric,
  total_savings_pct                     numeric,
  -- AI provenance
  ai_generated                          boolean not null default false,
  ai_generated_at                       timestamptz,
  ai_model_used                         text,
  user_edited                           boolean not null default false,
  user_edited_by                        uuid references profiles(id),
  user_edited_at                        timestamptz,
  notes                                 text,
  metadata                              jsonb default '{}',
  created_at                            timestamptz not null default now(),
  updated_at                            timestamptz not null default now(),
  unique(assessment_id)
);

create index site_savings_site_idx on site_savings_analysis(site_id);

-- ═══════════════════════════════════════════════════════════════
-- Document Extractions — AI extraction from uploaded docs (Phase 2)
-- ═══════════════════════════════════════════════════════════════

create table document_extractions (
  id              uuid primary key default gen_random_uuid(),
  attachment_id   uuid not null references attachments(id) on delete cascade,
  site_id         uuid not null references sites(id) on delete cascade,
  tenant_id       uuid not null references tenants(id) on delete cascade,
  document_type   text,
  status          extraction_status not null default 'pending',
  extracted_data  jsonb default '{}',
  confidence      numeric,
  error           text,
  reviewed_by     uuid references profiles(id),
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index doc_extractions_site_idx on document_extractions(site_id);
create index doc_extractions_attachment_idx on document_extractions(attachment_id);

-- ═══════════════════════════════════════════════════════════════
-- Assessment Interviews — Voice interview sessions (Phase 3)
-- ═══════════════════════════════════════════════════════════════

create table assessment_interviews (
  id              uuid primary key default gen_random_uuid(),
  assessment_id   uuid not null references site_assessments(id) on delete cascade,
  site_id         uuid not null references sites(id) on delete cascade,
  tenant_id       uuid not null references tenants(id) on delete cascade,
  invite_token    text not null unique,
  contact_name    text,
  contact_email   text,
  status          text not null default 'pending',
  transcript      text,
  extracted_data  jsonb default '{}',
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index assessment_interviews_token_idx on assessment_interviews(invite_token);
create index assessment_interviews_site_idx on assessment_interviews(site_id);

-- ═══════════════════════════════════════════════════════════════
-- Reference Data — COP table, CP rates, climate zones, KPI goals
-- ═══════════════════════════════════════════════════════════════

create table reference_data (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  data        jsonb not null default '{}',
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════
-- Updated_at triggers for all new tables
-- ═══════════════════════════════════════════════════════════════

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'site_assessments', 'site_operational_params', 'site_equipment',
      'site_energy_data', 'site_rate_structure', 'site_operations',
      'site_load_breakdown', 'site_arco_performance', 'site_savings_analysis',
      'document_extractions', 'assessment_interviews', 'reference_data'
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
-- RLS Policies — All assessment data visible to tenant
-- ═══════════════════════════════════════════════════════════════

-- Enable RLS on all new tables
alter table site_assessments enable row level security;
alter table site_operational_params enable row level security;
alter table site_equipment enable row level security;
alter table site_energy_data enable row level security;
alter table site_rate_structure enable row level security;
alter table site_operations enable row level security;
alter table site_load_breakdown enable row level security;
alter table site_arco_performance enable row level security;
alter table site_savings_analysis enable row level security;
alter table document_extractions enable row level security;
alter table assessment_interviews enable row level security;
alter table reference_data enable row level security;

-- Macro for assessment table RLS (readable by tenant, writable by internal)
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'site_assessments', 'site_operational_params', 'site_equipment',
      'site_energy_data', 'site_rate_structure', 'site_operations',
      'site_load_breakdown', 'site_arco_performance', 'site_savings_analysis',
      'document_extractions', 'assessment_interviews'
    ])
  loop
    execute format('create policy %I on %I for select using (public.can_read_tenant(tenant_id))', t || '_select', t);
    execute format('create policy %I on %I for insert with check (public.is_internal())', t || '_insert', t);
    execute format('create policy %I on %I for update using (public.is_internal())', t || '_update', t);
    execute format('create policy %I on %I for delete using (public.is_internal())', t || '_delete', t);
  end loop;
end;
$$;

-- Reference data: readable by all authenticated, writable by internal admins
create policy reference_data_select on reference_data for select using (true);
create policy reference_data_insert on reference_data for insert with check (public.is_internal());
create policy reference_data_update on reference_data for update using (public.is_internal());

-- ═══════════════════════════════════════════════════════════════
-- Seed: KPI goal ranges
-- ═══════════════════════════════════════════════════════════════

insert into reference_data (key, data, description) values
(
  'kpi_goals',
  '{
    "capex_roi_yrs": {"required_min": 3, "required_max": 7, "ideal_min": 4, "ideal_max": 6},
    "annualized_roi_x": {"required_min": 1.5, "required_max": 2.9, "ideal_min": 1.8, "ideal_max": 2.2},
    "five_year_irr": {"required_min": 0.10, "required_max": 0.30, "ideal_min": 0.15, "ideal_max": 0.25},
    "ten_year_irr": {"required_min": 0.10, "required_max": 0.50, "ideal_min": 0.15, "ideal_max": 0.35},
    "savings_pct_ref_load": {"required_min": 0.25, "required_max": 0.50, "ideal_min": 0.30, "ideal_max": 0.40}
  }',
  'KPI goal ranges for site assessment viability evaluation'
),
(
  'savings_opportunity_types',
  '[
    {"key": "refrigeration_efficiency", "label": "Refrigeration Efficiency", "description": "ARCO compressor optimization"},
    {"key": "demand_stabilization", "label": "Demand Stabilization", "description": "Peak demand smoothing"},
    {"key": "rate_arbitrage", "label": "Rate Arbitrage", "description": "TOU rate optimization"},
    {"key": "coincident_peak_avoidance", "label": "Coincident Peak Avoidance", "description": "CP tag reduction"},
    {"key": "blast_optimization", "label": "Blast Optimization", "description": "Blast freezer scheduling"}
  ]',
  'Energy AI application types for savings analysis'
);
