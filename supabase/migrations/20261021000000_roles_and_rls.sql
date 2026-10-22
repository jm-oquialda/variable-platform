-- Phase 1, step 1: roles, profiles, private talent rates, audit log.
-- Every table has row-level security enabled in this same file.

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'client', 'talent', 'partner');

-- ---------------------------------------------------------------------------
-- Profiles: one row per auth user, holds the role
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'client',
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Role lookups for policies. security definer so they can read profiles
-- without recursing into the profiles policies.
create function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

revoke execute on function public.current_app_role() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_admin() to authenticated;

create policy "profiles: read own"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "profiles: admin reads all"
  on public.profiles for select to authenticated
  using (public.is_admin());

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles: admin updates all"
  on public.profiles for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No insert policy: rows are created by the sign-up trigger only.
-- No delete policy: deleting the auth user cascades.

-- Only an admin can change a role, including their own. Changes made with no
-- signed-in user (SQL editor, service role) are allowed, which is how the
-- first admin is created:
--   update public.profiles set role = 'admin' where id = '<user id>';
create function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only an admin can change a role';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- Create the profile when someone signs up. Sign-up may ask for 'client' or
-- 'talent' only; 'admin' and 'partner' are granted by an admin later.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := new.raw_user_meta_data ->> 'role';
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    case when requested in ('client', 'talent') then requested::public.app_role else 'client' end,
    new.raw_user_meta_data ->> 'full_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Talent rates: private. Owner and admin only. Clients and partners never.
-- ---------------------------------------------------------------------------
create table public.talent_rates (
  talent_id uuid primary key references public.profiles (id) on delete cascade,
  -- Asking rate in US cents. Monthly for full time; hourly is optional.
  monthly_rate_cents integer not null check (monthly_rate_cents > 0),
  hourly_rate_cents integer check (hourly_rate_cents > 0),
  updated_at timestamptz not null default now()
);

alter table public.talent_rates enable row level security;

create policy "talent_rates: talent reads own"
  on public.talent_rates for select to authenticated
  using (talent_id = auth.uid() and public.current_app_role() = 'talent');

create policy "talent_rates: talent inserts own"
  on public.talent_rates for insert to authenticated
  with check (talent_id = auth.uid() and public.current_app_role() = 'talent');

create policy "talent_rates: talent updates own"
  on public.talent_rates for update to authenticated
  using (talent_id = auth.uid() and public.current_app_role() = 'talent')
  with check (talent_id = auth.uid() and public.current_app_role() = 'talent');

create policy "talent_rates: admin full access"
  on public.talent_rates for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.talent_rates from anon;

-- ---------------------------------------------------------------------------
-- Audit log: admin reads, nobody writes directly. Triggers write it.
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  table_name text not null,
  row_id text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;

create policy "audit_log: admin reads"
  on public.audit_log for select to authenticated
  using (public.is_admin());

revoke insert, update, delete on public.audit_log from anon, authenticated;

create function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  key_column text := tg_argv[0];
  rec jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_log (actor_id, table_name, row_id, action, old_data, new_data)
  values (
    auth.uid(),
    tg_table_name,
    rec ->> key_column,
    lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_talent_rates
  after insert or update or delete on public.talent_rates
  for each row execute function public.write_audit_log('talent_id');

create trigger audit_profile_role
  after update of role on public.profiles
  for each row execute function public.write_audit_log('id');

-- Keep talent_rates.updated_at current.
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger touch_talent_rates
  before update on public.talent_rates
  for each row execute function public.touch_updated_at();
