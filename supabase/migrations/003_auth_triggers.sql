-- ATLAS Collaborate — Auth Triggers
-- Auto-create profile on user signup + set JWT custom claims
--
-- FIXES applied:
-- 1. profiles.user_id is now nullable (invite pre-creation)
-- 2. Unknown domain signups get a dedicated "unassigned" tenant, not CK
-- 3. JWT uses 'app_role' instead of 'role' to avoid Supabase collision
-- 4. JWT hook only sets claims for active users
-- 5. Unique partial index on email for pending invites

-- ═══════════════════════════════════════════════════════════════
-- Schema fix: make user_id nullable for invite pre-creation
-- ═══════════════════════════════════════════════════════════════

alter table profiles alter column user_id drop not null;

-- Drop the original unique constraint (created in 001) and replace with partial index
alter table profiles drop constraint if exists profiles_user_id_key;

-- Partial unique: only one profile per user (when linked)
create unique index if not exists profiles_user_id_unique on profiles (user_id) where user_id is not null;

-- Prevent duplicate pending invites for the same email
create unique index profiles_email_pending_unique on profiles (email) where user_id is null;

-- ═══════════════════════════════════════════════════════════════
-- Seed: unassigned tenant for unknown domain signups
-- ═══════════════════════════════════════════════════════════════

insert into tenants (id, name, type) values
  ('00000000-0000-0000-0000-000000000000', '_unassigned', 'customer')
on conflict do nothing;

-- ═══════════════════════════════════════════════════════════════
-- Trigger: create profile when auth.users row is created
-- ═══════════════════════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _email text;
  _domain text;
  _tenant_id uuid;
  _existing_profile profiles%rowtype;
  _role user_role;
  _status profile_status;
  _full_name text;
begin
  _email := new.email;
  _domain := split_part(_email, '@', 2);
  _full_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(_email, '@', 1)
  );

  -- Check if a profile was pre-created (via invite)
  select * into _existing_profile
  from profiles
  where email = _email and user_id is null
  limit 1;

  if _existing_profile.id is not null then
    -- Link existing invited profile to this auth user
    update profiles
    set user_id = new.id,
        status = 'active',
        full_name = coalesce(_full_name, _existing_profile.full_name),
        avatar_url = coalesce(new.raw_user_meta_data->>'avatar_url', _existing_profile.avatar_url),
        updated_at = now()
    where id = _existing_profile.id;

    return new;
  end if;

  -- No pre-created profile — determine tenant by domain
  if _domain = 'crossnokaye.com' then
    -- CK internal user — auto-activate
    _tenant_id := '00000000-0000-0000-0000-000000000001'; -- CK tenant
    _role := 'member';
    _status := 'active';
  else
    -- Try to match to existing customer tenant by domain
    select id into _tenant_id
    from tenants
    where domain = _domain and type = 'customer'
    limit 1;

    if _tenant_id is not null then
      -- Domain matches a customer tenant — pending approval
      _role := 'member';
      _status := 'pending_approval';
    else
      -- No matching tenant — park in unassigned tenant
      -- Admin will reassign to the correct tenant
      _tenant_id := '00000000-0000-0000-0000-000000000000'; -- unassigned
      _role := 'member';
      _status := 'pending_approval';
    end if;
  end if;

  insert into profiles (user_id, tenant_id, role, status, full_name, email, avatar_url)
  values (
    new.id,
    _tenant_id,
    _role,
    _status,
    _full_name,
    _email,
    new.raw_user_meta_data->>'avatar_url'
  );

  return new;
end;
$$;

-- Revoke direct execute from non-trigger callers
revoke execute on function public.handle_new_user from authenticated, anon, public;

-- Bind trigger to auth.users inserts
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════
-- Function: set custom JWT claims (called by Supabase Auth hook)
-- Uses 'app_role' to avoid collision with Supabase's built-in 'role'
-- Only sets claims for ACTIVE users — pending/disabled get no claims
-- ═══════════════════════════════════════════════════════════════

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  _profile record;
begin
  claims := event->'claims';

  -- Look up the user's profile + tenant
  select
    p.tenant_id,
    t.type::text as tenant_type,
    p.role::text as app_role,
    p.id as profile_id,
    p.status::text as profile_status
  into _profile
  from profiles p
  join tenants t on t.id = p.tenant_id
  where p.user_id = (event->>'user_id')::uuid
  limit 1;

  if _profile is not null and _profile.profile_status = 'active' then
    -- Active user: inject full custom claims
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(_profile.tenant_id));
    claims := jsonb_set(claims, '{tenant_type}', to_jsonb(_profile.tenant_type));
    claims := jsonb_set(claims, '{app_role}', to_jsonb(_profile.app_role));
    claims := jsonb_set(claims, '{profile_id}', to_jsonb(_profile.profile_id));
    claims := jsonb_set(claims, '{profile_status}', to_jsonb('active'::text));
  elsif _profile is not null then
    -- Non-active user: only set status so middleware can redirect
    claims := jsonb_set(claims, '{profile_status}', to_jsonb(_profile.profile_status));
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- Grant execute to supabase_auth_admin (needed for Auth hooks)
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
