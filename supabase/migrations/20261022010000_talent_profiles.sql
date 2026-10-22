-- Phase 1, step 5: talent sign-up and profile (plan sections 2, 7 and 13).
--
-- talent_profiles is private: the talent and admin only. Clients will see
-- a separate, limited profile (first name, last initial, structured
-- fields) once matching is built. Resumes live in a private bucket and
-- are never sent to clients.

create table public.talent_profiles (
  talent_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- About
  first_name text check (length(first_name) <= 100),
  last_name text check (length(last_name) <= 100),
  phone text check (length(phone) <= 40),
  city text check (length(city) <= 100),

  -- Role
  niche text check (length(niche) <= 100),
  headline text check (length(headline) <= 140),
  years_experience integer check (years_experience between 0 and 50),
  skills text[] not null default '{}' check (cardinality(skills) <= 20),
  tools text[] not null default '{}' check (cardinality(tools) <= 30),
  summary text check (length(summary) <= 2000),

  -- Links
  portfolio_url text check (length(portfolio_url) <= 500),
  linkedin_url text check (length(linkedin_url) <= 500),
  intro_video_url text check (length(intro_video_url) <= 500),

  -- Availability
  schedule text check (schedule in ('full_time', 'part_time', 'either')),
  overlap text check (overlap in ('pacific', 'eastern', 'either')),
  available_from date,

  -- Resume: path inside the private 'resumes' bucket, '<talent_id>/<file>'.
  resume_path text check (resume_path is null or resume_path like talent_id::text || '/%'),

  -- Vetting. Talent may move draft -> submitted; every other change is admin.
  vetting_status text not null default 'draft'
    check (vetting_status in ('draft', 'submitted', 'screening', 'skills_test', 'interview', 'accepted', 'rejected', 'paused')),
  submitted_at timestamptz,
  -- Philippine Data Privacy Act consent, required before submitting.
  privacy_consent_at timestamptz,
  check (vetting_status = 'draft' or privacy_consent_at is not null)
);

alter table public.talent_profiles enable row level security;

create policy "talent_profiles: talent reads own"
  on public.talent_profiles for select to authenticated
  using (talent_id = auth.uid() and public.current_app_role() = 'talent');

create policy "talent_profiles: talent creates own"
  on public.talent_profiles for insert to authenticated
  with check (talent_id = auth.uid() and public.current_app_role() = 'talent');

create policy "talent_profiles: talent updates own"
  on public.talent_profiles for update to authenticated
  using (talent_id = auth.uid() and public.current_app_role() = 'talent')
  with check (talent_id = auth.uid() and public.current_app_role() = 'talent');

create policy "talent_profiles: admin full access"
  on public.talent_profiles for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.talent_profiles from anon;

-- Talent can only submit their own profile; admin moves it through vetting.
create function public.guard_talent_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_status text := case when tg_op = 'UPDATE' then old.vetting_status else 'draft' end;
begin
  if not public.is_admin() and auth.uid() is not null then
    if new.vetting_status is distinct from old_status
       and not (old_status = 'draft' and new.vetting_status = 'submitted') then
      raise exception 'Only VAriable can change the vetting status';
    end if;
    if tg_op = 'UPDATE' then
      new.submitted_at := old.submitted_at;
    else
      new.submitted_at := null;
    end if;
  end if;

  if new.vetting_status = 'submitted' and old_status = 'draft' then
    new.submitted_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger guard_talent_profile
  before insert or update on public.talent_profiles
  for each row execute function public.guard_talent_profile();

create trigger audit_talent_profile_status
  after update of vetting_status on public.talent_profiles
  for each row execute function public.write_audit_log('talent_id');

-- ---------------------------------------------------------------------------
-- Resume storage: private bucket, one folder per talent
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes',
  'resumes',
  false,
  5242880, -- 5 MB
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
);

create policy "resumes: talent reads own"
  on storage.objects for select to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "resumes: talent uploads own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_app_role() = 'talent'
  );

create policy "resumes: talent deletes own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "resumes: admin reads all"
  on storage.objects for select to authenticated
  using (bucket_id = 'resumes' and public.is_admin());
