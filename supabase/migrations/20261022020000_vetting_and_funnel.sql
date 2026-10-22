-- Phase 1, step 6: admin vetting queue and funnel stats (plan sections 3, 8B, 9).
--
-- Every vetting status change is logged in vetting_events, which is what
-- the funnel and the "top 1%" claim are calculated from. Past applicant
-- counts (before the platform, including OnlineJobs.ph) are entered by
-- admin per month. All of it is admin only.

-- ---------------------------------------------------------------------------
-- Email on profiles, so admin can contact applicants. Copied from auth at
-- sign-up; users cannot edit their own copy.
-- ---------------------------------------------------------------------------
alter table public.profiles add column email text;
update public.profiles p set email = u.email from auth.users u where u.id = p.id;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := new.raw_user_meta_data ->> 'role';
begin
  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    case when requested in ('client', 'talent') then requested::public.app_role else 'client' end,
    new.raw_user_meta_data ->> 'full_name',
    new.email
  );
  return new;
end;
$$;

create function public.protect_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email and auth.uid() is not null and not public.is_admin() then
    new.email := old.email;
  end if;
  return new;
end;
$$;

create trigger protect_profile_email
  before update on public.profiles
  for each row execute function public.protect_profile_email();

-- ---------------------------------------------------------------------------
-- Vetting events: written by trigger, never directly
-- ---------------------------------------------------------------------------
create table public.vetting_events (
  id bigint generated always as identity primary key,
  talent_id uuid not null references public.talent_profiles (talent_id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_id uuid,
  note text check (length(note) <= 2000),
  created_at timestamptz not null default now()
);

create index vetting_events_talent on public.vetting_events (talent_id, created_at);
create index vetting_events_created on public.vetting_events (created_at);

alter table public.vetting_events enable row level security;

create policy "vetting_events: admin reads"
  on public.vetting_events for select to authenticated
  using (public.is_admin());

revoke insert, update, delete on public.vetting_events from anon, authenticated;

create function public.log_vetting_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous text := case when tg_op = 'UPDATE' then old.vetting_status end;
begin
  if new.vetting_status is distinct from previous and not (tg_op = 'INSERT' and new.vetting_status = 'draft') then
    insert into public.vetting_events (talent_id, from_status, to_status, actor_id, note)
    values (new.talent_id, previous, new.vetting_status, auth.uid(),
            nullif(current_setting('app.vetting_note', true), ''));
  end if;
  return new;
end;
$$;

create trigger log_vetting_event
  after insert or update of vetting_status on public.talent_profiles
  for each row execute function public.log_vetting_event();

-- Admin changes a status with an optional note, in one transaction so the
-- note lands on the event the trigger writes.
create function public.set_vetting_status(p_talent_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can change a vetting status';
  end if;
  perform set_config('app.vetting_note', coalesce(p_note, ''), true);
  update public.talent_profiles set vetting_status = p_status where talent_id = p_talent_id;
  if not found then
    raise exception 'No talent profile %', p_talent_id;
  end if;
  perform set_config('app.vetting_note', '', true);
end;
$$;

revoke execute on function public.set_vetting_status(uuid, text, text) from public, anon;
grant execute on function public.set_vetting_status(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Scorecards: one per applicant, 1 to 5 per criterion
-- ---------------------------------------------------------------------------
create table public.vetting_scorecards (
  talent_id uuid primary key references public.talent_profiles (talent_id) on delete cascade,
  communication smallint check (communication between 1 and 5),
  written_english smallint check (written_english between 1 and 5),
  role_skills smallint check (role_skills between 1 and 5),
  ai_tools smallint check (ai_tools between 1 and 5),
  reliability smallint check (reliability between 1 and 5),
  notes text check (length(notes) <= 4000),
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.vetting_scorecards enable row level security;

create policy "vetting_scorecards: admin full access"
  on public.vetting_scorecards for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.vetting_scorecards from anon;

create trigger touch_vetting_scorecards
  before update on public.vetting_scorecards
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Past applicant counts, per month and source
-- ---------------------------------------------------------------------------
create table public.historical_funnel_counts (
  month date not null check (extract(day from month) = 1),
  source text not null check (length(source) between 1 and 60),
  applied integer not null check (applied >= 0),
  screened integer not null default 0 check (screened >= 0),
  tested integer not null default 0 check (tested >= 0),
  interviewed integer not null default 0 check (interviewed >= 0),
  accepted integer not null default 0 check (accepted >= 0),
  updated_at timestamptz not null default now(),
  primary key (month, source),
  check (accepted <= applied and screened <= applied and tested <= applied and interviewed <= applied)
);

alter table public.historical_funnel_counts enable row level security;

create policy "historical_funnel_counts: admin full access"
  on public.historical_funnel_counts for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.historical_funnel_counts from anon;

create trigger audit_historical_funnel_counts
  after insert or update or delete on public.historical_funnel_counts
  for each row execute function public.write_audit_log('month');

create trigger touch_historical_funnel_counts
  before update on public.historical_funnel_counts
  for each row execute function public.touch_updated_at();
