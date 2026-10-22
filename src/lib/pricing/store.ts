import type { SupabaseClient } from "@supabase/supabase-js";
import { quote, resolveSettings, type PricingRule } from "./index";

// Database access for pricing. Pass the signed-in user's Supabase client:
// row-level security decides what each role can read and write.

export type PricingRuleRow = PricingRule & { id: number };

type RuleRecord = {
  id: number;
  scope: PricingRule["scope"];
  scope_id: string | null;
  target_margin_bps: number | null;
  standard_uplift_bps: number | null;
  rounding_step_cents: number | null;
};

export type TierRow = {
  slug: string;
  name: string;
  sort_order: number;
  commitment_price_cents: number | null;
  standard_price_cents: number | null;
  prices_published_at: string | null;
};

export type AddonPackageRow = {
  slug: string;
  name: string;
  description: string;
  sort_order: number;
  setup_cents: number | null;
  monthly_cents: number | null;
};

function toRule(r: RuleRecord): PricingRuleRow {
  return {
    id: r.id,
    scope: r.scope,
    scopeId: r.scope_id ?? undefined,
    targetMarginBps: r.target_margin_bps ?? undefined,
    standardUpliftBps: r.standard_uplift_bps ?? undefined,
    roundingStepCents: r.rounding_step_cents ?? undefined,
  };
}

// Admin only. Returns [] for anyone else.
export async function loadPricingRules(supabase: SupabaseClient): Promise<PricingRuleRow[]> {
  const { data, error } = await supabase
    .from("pricing_rules")
    .select("id, scope, scope_id, target_margin_bps, standard_uplift_bps, rounding_step_cents")
    .order("scope")
    .order("scope_id");
  if (error) throw new Error(`Could not load pricing rules: ${error.message}`);
  return (data as RuleRecord[]).map(toRule);
}

// Admin only. Tier slug -> minimum monthly talent rate in cents.
export async function loadTierMinRates(supabase: SupabaseClient): Promise<Map<string, number>> {
  const { data, error } = await supabase.from("tier_min_rates").select("tier_slug, min_monthly_rate_cents");
  if (error) throw new Error(`Could not load tier minimum rates: ${error.message}`);
  return new Map(
    (data as { tier_slug: string; min_monthly_rate_cents: number }[]).map((r) => [r.tier_slug, r.min_monthly_rate_cents]),
  );
}

// Public.
export async function loadTiers(supabase: SupabaseClient): Promise<TierRow[]> {
  const { data, error } = await supabase
    .from("tiers")
    .select("slug, name, sort_order, commitment_price_cents, standard_price_cents, prices_published_at")
    .order("sort_order");
  if (error) throw new Error(`Could not load tiers: ${error.message}`);
  return data as TierRow[];
}

// Public.
export async function loadAddonPackages(supabase: SupabaseClient): Promise<AddonPackageRow[]> {
  const { data, error } = await supabase
    .from("addon_packages")
    .select("slug, name, description, sort_order, setup_cents, monthly_cents")
    .order("sort_order");
  if (error) throw new Error(`Could not load add-on packages: ${error.message}`);
  return data as AddonPackageRow[];
}

// Admin only. Recalculates every tier's public "starting at" prices from its
// minimum talent rate and the global rule, and publishes them. Run after any
// change to the global rule or a tier minimum. Public prices use the global
// rule only: overrides apply to individual quotes, not the landing page.
export async function publishTierPrices(supabase: SupabaseClient) {
  const rules = await loadPricingRules(supabase);
  const settings = resolveSettings(rules.filter((r) => r.scope === "global"));
  const minRates = await loadTierMinRates(supabase);
  const publishedAt = new Date().toISOString();

  for (const [slug, minRate] of minRates) {
    const q = quote(minRate, settings);
    const { error } = await supabase
      .from("tiers")
      .update({
        commitment_price_cents: q.commitmentPriceCents,
        standard_price_cents: q.standardPriceCents,
        prices_published_at: publishedAt,
      })
      .eq("slug", slug);
    if (error) throw new Error(`Could not publish ${slug} prices: ${error.message}`);
  }
}
