-- Migration: Rename "customers" concept to "companies" and add company_type + custom milestone templates
-- The DB table stays as "customers" to avoid massive FK/RLS rewrites, but we add:
-- 1. company_type enum (customer vs prospect) on the customers table
-- 2. customer_id FK on milestone_templates for per-company custom templates

-- 1. Create company_type enum
create type company_type as enum ('customer', 'prospect');

-- 2. Add company_type column to customers (default to 'customer' for existing rows)
alter table customers
  add column company_type company_type not null default 'customer';

-- 3. Add customer_id to milestone_templates for per-company custom templates
--    NULL customer_id = global ATLAS default templates (existing rows)
--    Non-null customer_id = company-specific custom templates
alter table milestone_templates
  add column customer_id uuid references customers (id) on delete cascade;

create index milestone_templates_customer_idx on milestone_templates (customer_id);

-- 4. Update RLS on milestone_templates to allow per-company visibility
--    Internal users see all templates; customer users see global + their own company's templates
drop policy if exists "milestone_templates_select" on milestone_templates;
create policy "milestone_templates_select" on milestone_templates
  for select using (
    public.is_active() and (
      customer_id is null  -- global templates visible to everyone
      or public.is_internal()  -- internal users see all
      or customer_id in (
        select id from customers where tenant_id = (
          select (current_setting('request.jwt.claims', true)::jsonb ->> 'tenantId')::uuid
        )
      )
    )
  );

-- 5. Allow internal users to manage milestone templates
create policy "milestone_templates_insert" on milestone_templates
  for insert with check (public.is_internal());

create policy "milestone_templates_update" on milestone_templates
  for update using (public.is_internal());

create policy "milestone_templates_delete" on milestone_templates
  for delete using (public.is_internal());
