-- Phase 1, step 7: one-time import of existing talent from Google Sheets.
--
-- The import runs locally with the service role (scripts/import-talent.ts).
-- It keeps the sheet's own ID, records where privacy consent came from, and
-- backdates vetting history to the real application dates so the funnel
-- counts imported applicants in the right month.

alter table public.talent_profiles
  add column external_ref text check (length(external_ref) <= 60),
  add column privacy_consent_source text check (privacy_consent_source in ('platform', 'application_form'));

create unique index talent_profiles_external_ref on public.talent_profiles (external_ref) where external_ref is not null;

-- Consent given on the platform so far is marked as such.
update public.talent_profiles set privacy_consent_source = 'platform' where privacy_consent_at is not null;

-- Event time override. Only honoured with no signed-in user (service role
-- or SQL editor), so nobody can backdate their own history through the API.
create function public.vetting_event_time()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
    when auth.uid() is null then coalesce(nullif(current_setting('app.vetting_event_at', true), '')::timestamptz, now())
    else now()
  end;
$$;

create or replace function public.guard_talent_profile()
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
      new.external_ref := old.external_ref;
      new.privacy_consent_source := old.privacy_consent_source;
    else
      new.submitted_at := null;
      new.external_ref := null;
    end if;
    -- Consent given through the platform form.
    if new.privacy_consent_at is not null and new.privacy_consent_source is null then
      new.privacy_consent_source := 'platform';
    end if;
  end if;

  if new.vetting_status <> 'draft' and old_status = 'draft' and new.submitted_at is null then
    new.submitted_at := public.vetting_event_time();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.log_vetting_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous text := case when tg_op = 'UPDATE' then old.vetting_status end;
begin
  if new.vetting_status is distinct from previous and not (tg_op = 'INSERT' and new.vetting_status = 'draft') then
    insert into public.vetting_events (talent_id, from_status, to_status, actor_id, note, created_at)
    values (new.talent_id, previous, new.vetting_status, auth.uid(),
            nullif(current_setting('app.vetting_note', true), ''), public.vetting_event_time());
  end if;
  return new;
end;
$$;

-- Moves an imported draft to its sheet status with the real dates:
-- "submitted" at the application date, then the current status at the
-- sheet's last-updated date. Service role only.
create function public.import_talent_history(
  p_talent_id uuid,
  p_status text,
  p_applied_at timestamptz,
  p_status_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    raise exception 'import_talent_history is for the import script only';
  end if;
  if (select vetting_status from public.talent_profiles where talent_id = p_talent_id) is distinct from 'draft' then
    raise exception 'Talent % is not a draft; history was already imported', p_talent_id;
  end if;

  perform set_config('app.vetting_note', 'Imported from Google Sheets', true);
  perform set_config('app.vetting_event_at', p_applied_at::text, true);
  update public.talent_profiles set vetting_status = 'submitted', submitted_at = p_applied_at
  where talent_id = p_talent_id;

  if p_status <> 'submitted' then
    perform set_config('app.vetting_event_at', greatest(p_status_at, p_applied_at)::text, true);
    update public.talent_profiles set vetting_status = p_status where talent_id = p_talent_id;
  end if;

  perform set_config('app.vetting_event_at', '', true);
  perform set_config('app.vetting_note', '', true);
end;
$$;

revoke execute on function public.import_talent_history(uuid, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.import_talent_history(uuid, text, timestamptz, timestamptz) to service_role;
