-- Phase 1, step 3: admin pricing settings and public "starting at" prices.
--
-- Private (admin only): pricing_rules, tier_min_rates.
-- Public (anyone can read, admin writes): tiers, addon_packages.
-- The app calculates tier prices with src/lib/pricing and writes only the
-- resulting prices to tiers, so the minimum talent rate never leaves admin.

-- ---------------------------------------------------------------------------
-- Pricing rules: global default plus overrides by role, partner or client
-- ---------------------------------------------------------------------------
create type public.pricing_scope as enum ('global', 'role', 'partner', 'client');

create table public.pricing_rules (
  id bigint generated always as identity primary key,
  scope public.pricing_scope not null,
  -- Niche slug for 'role', partner id or client id. Null for 'global'.
  scope_id text,
  -- Null means "fall back to the next, less specific rule".
  target_margin_bps integer check (target_margin_bps between 0 and 9999),
  standard_uplift_bps integer check (standard_uplift_bps >= 10000),
  rounding_step_cents integer check (rounding_step_cents > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope = 'global') = (scope_id is null)),
  -- The global rule sets everything, so every price has a full fallback.
  check (scope <> 'global' or (target_margin_bps is not null
                               and standard_uplift_bps is not null
                               and rounding_step_cents is not null))
);

create unique index pricing_rules_one_per_scope
  on public.pricing_rules (scope, coalesce(scope_id, ''));

alter table public.pricing_rules enable row level security;

create policy "pricing_rules: admin full access"
  on public.pricing_rules for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.pricing_rules from anon;

-- The global rule cannot be deleted, only changed.
create function public.keep_global_pricing_rule()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.scope = 'global' then
    raise exception 'The global pricing rule cannot be deleted';
  end if;
  return old;
end;
$$;

create trigger keep_global_pricing_rule
  before delete on public.pricing_rules
  for each row execute function public.keep_global_pricing_rule();

-- ---------------------------------------------------------------------------
-- Tiers: public names and published "starting at" prices
-- ---------------------------------------------------------------------------
create table public.tiers (
  slug text primary key,
  name text not null,
  sort_order integer not null,
  -- Published prices, calculated by the app from tier_min_rates and the
  -- global rule. Null until first published.
  commitment_price_cents integer check (commitment_price_cents > 0),
  standard_price_cents integer check (standard_price_cents > 0),
  prices_published_at timestamptz
);

alter table public.tiers enable row level security;

create policy "tiers: anyone reads"
  on public.tiers for select to anon, authenticated
  using (true);

create policy "tiers: admin writes"
  on public.tiers for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Tier minimum talent rates: private, admin only
-- ---------------------------------------------------------------------------
create table public.tier_min_rates (
  tier_slug text primary key references public.tiers (slug) on delete cascade,
  min_monthly_rate_cents integer not null check (min_monthly_rate_cents > 0),
  updated_at timestamptz not null default now()
);

alter table public.tier_min_rates enable row level security;

create policy "tier_min_rates: admin full access"
  on public.tier_min_rates for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.tier_min_rates from anon;

-- ---------------------------------------------------------------------------
-- Custom AI Agent Build packages: public prices, admin writes
-- ---------------------------------------------------------------------------
create table public.addon_packages (
  slug text primary key,
  name text not null,
  description text not null,
  sort_order integer not null,
  -- Null means "quoted".
  setup_cents integer check (setup_cents > 0),
  monthly_cents integer check (monthly_cents > 0),
  updated_at timestamptz not null default now()
);

alter table public.addon_packages enable row level security;

create policy "addon_packages: anyone reads"
  on public.addon_packages for select to anon, authenticated
  using (true);

create policy "addon_packages: admin writes"
  on public.addon_packages for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Audit and timestamps
-- ---------------------------------------------------------------------------
create trigger audit_pricing_rules
  after insert or update or delete on public.pricing_rules
  for each row execute function public.write_audit_log('id');

create trigger audit_tier_min_rates
  after insert or update or delete on public.tier_min_rates
  for each row execute function public.write_audit_log('tier_slug');

create trigger audit_tiers
  after update on public.tiers
  for each row execute function public.write_audit_log('slug');

create trigger audit_addon_packages
  after insert or update or delete on public.addon_packages
  for each row execute function public.write_audit_log('slug');

create trigger touch_pricing_rules
  before update on public.pricing_rules
  for each row execute function public.touch_updated_at();

create trigger touch_tier_min_rates
  before update on public.tier_min_rates
  for each row execute function public.touch_updated_at();

create trigger touch_addon_packages
  before update on public.addon_packages
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Starting values from the plan (section 3 and 4).
-- TODO(confirm): minimum rates and add-on prices are illustrative in the
-- plan. Jhona confirms them in /admin/pricing, which also publishes prices.
-- ---------------------------------------------------------------------------
insert into public.pricing_rules (scope, target_margin_bps, standard_uplift_bps, rounding_step_cents)
values ('global', 4500, 12000, 500);

insert into public.tiers (slug, name, sort_order) values
  ('essentials', 'Essentials', 1),
  ('professional', 'Professional', 2),
  ('executive', 'Executive', 3);

insert into public.tier_min_rates (tier_slug, min_monthly_rate_cents) values
  ('essentials', 80000),
  ('professional', 100000),
  ('executive', 130000);

insert into public.addon_packages (slug, name, description, sort_order, setup_cents, monthly_cents) values
  ('starter', 'Starter', '1 agent, 1 workflow', 1, 150000, 20000),
  ('growth', 'Growth', 'Up to 3 agents', 2, 400000, 45000),
  ('custom', 'Custom', 'Larger or integrated builds', 3, null, null);
