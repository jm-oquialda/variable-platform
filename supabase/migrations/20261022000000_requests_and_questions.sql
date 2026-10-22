-- Phase 1, step 4: "Request talent" submissions and visitor questions.
--
-- Anyone (signed in or not) can submit. Nobody but admin can read
-- submissions, except that a signed-in client reads their own requests.
-- Column-level grants limit what a submitter can set: status, notes and
-- source are admin fields and always start at their defaults.

-- ---------------------------------------------------------------------------
-- Talent requests
-- ---------------------------------------------------------------------------
create table public.talent_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Set when a signed-in client submits; null for website visitors.
  client_id uuid references public.profiles (id) on delete set null,
  contact_name text not null check (length(contact_name) between 1 and 200),
  contact_email text not null check (contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(contact_email) <= 320),
  company text not null check (length(company) between 1 and 200),
  company_website text check (length(company_website) <= 500),

  niche text not null check (length(niche) between 1 and 100),
  tasks text not null check (length(tasks) between 1 and 4000),
  tools text check (length(tools) <= 1000),
  schedule text not null check (schedule in ('full_time', 'part_time')),
  time_zone text not null check (time_zone in ('pacific', 'mountain', 'central', 'eastern', 'other')),
  -- Null means "not sure yet".
  tier_slug text references public.tiers (slug),
  commitment text not null check (commitment in ('six_month', 'month_to_month', 'undecided')),
  ai_agent_build boolean not null default false,
  start_date date,

  -- Admin fields.
  source text not null default 'website' check (source in ('website', 'partner', 'admin')),
  partner_name text check (length(partner_name) <= 200),
  status text not null default 'new' check (status in ('new', 'matching', 'interviewing', 'placed', 'closed')),
  admin_notes text
);

create index talent_requests_created_at on public.talent_requests (created_at desc);
create index talent_requests_client_id on public.talent_requests (client_id);

alter table public.talent_requests enable row level security;

create policy "talent_requests: anyone submits"
  on public.talent_requests for insert to anon, authenticated
  with check (client_id is null or client_id = auth.uid());

create policy "talent_requests: client reads own"
  on public.talent_requests for select to authenticated
  using (client_id = auth.uid());

create policy "talent_requests: admin full access"
  on public.talent_requests for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Submitters may only fill the form columns. Admin columns are granted to
-- authenticated (so admin can enter partner requests) and reset for
-- everyone else by the trigger below.
revoke insert, update, delete on public.talent_requests from anon, authenticated;
grant insert (client_id, contact_name, contact_email, company, company_website, niche, tasks, tools,
              schedule, time_zone, tier_slug, commitment, ai_agent_build, start_date)
  on public.talent_requests to anon, authenticated;
grant update, delete on public.talent_requests to authenticated; -- RLS limits this to admin
grant insert (source, partner_name, status, admin_notes) on public.talent_requests to authenticated;

-- Non-admins cannot use the admin columns, even though authenticated has
-- the column grant (needed so admin can enter partner requests).
create function public.guard_talent_request_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    new.source := 'website';
    new.partner_name := null;
    new.status := 'new';
    new.admin_notes := null;
  end if;
  return new;
end;
$$;

create trigger guard_talent_request_insert
  before insert on public.talent_requests
  for each row execute function public.guard_talent_request_insert();

create trigger touch_talent_requests
  before update on public.talent_requests
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Visitor questions ("Ask a question" on the website)
-- ---------------------------------------------------------------------------
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (length(name) between 1 and 200),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 320),
  message text not null check (length(message) between 1 and 4000),
  handled boolean not null default false
);

alter table public.questions enable row level security;

create policy "questions: anyone asks"
  on public.questions for insert to anon, authenticated
  with check (true);

create policy "questions: admin full access"
  on public.questions for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke insert, update, delete on public.questions from anon, authenticated;
grant insert (name, email, message) on public.questions to anon, authenticated;
grant update, delete on public.questions to authenticated; -- RLS limits this to admin
