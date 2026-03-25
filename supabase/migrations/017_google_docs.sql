-- Links Google Workspace files (Docs, Sheets, Slides) to sites
create table if not exists site_google_docs (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  site_id         uuid not null references sites(id) on delete cascade,
  google_file_id  text not null,
  title           text not null,
  mime_type       text not null,
  google_url      text not null,
  thumbnail_url   text,
  icon_url        text,
  linked_by       uuid not null references profiles(id),
  metadata        jsonb default '{}',
  created_at      timestamptz not null default now(),
  unique(site_id, google_file_id)
);

create index if not exists site_google_docs_site_idx on site_google_docs(site_id);
create index if not exists site_google_docs_tenant_idx on site_google_docs(tenant_id);

-- RLS: tenant-scoped access
alter table site_google_docs enable row level security;

create policy "Users can view google docs in their tenant"
  on site_google_docs for select
  using (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid);

create policy "Users can link google docs in their tenant"
  on site_google_docs for insert
  with check (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid);

create policy "Users can unlink google docs in their tenant"
  on site_google_docs for delete
  using (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid);

-- Google OAuth tokens for Drive API access (per user)
create table if not exists user_google_tokens (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  access_token    text not null,
  refresh_token   text,
  expires_at      timestamptz not null,
  scopes          text not null,
  updated_at      timestamptz not null default now()
);

-- RLS: users can only access their own tokens
alter table user_google_tokens enable row level security;

create policy "Users can manage their own google tokens"
  on user_google_tokens for all
  using (user_id = auth.uid());
