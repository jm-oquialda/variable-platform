"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { isNiche } from "@/lib/niches";
import { validateSettings } from "@/lib/pricing";
import { parseDollarsToCents, parseMultiplierToBps, parsePercentToBps } from "@/lib/pricing/format";
import { publishTierPrices } from "@/lib/pricing/store";
import { createClient } from "@/lib/supabase/server";

// Server actions are public endpoints, so each one checks the role itself.
// Row-level security blocks non-admin writes as well.

function done(saved: string): never {
  revalidatePath("/admin/pricing");
  revalidatePath("/");
  redirect(`/admin/pricing?saved=${saved}`);
}

function fail(error: string): never {
  redirect(`/admin/pricing?error=${error}`);
}

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export async function saveGlobalRule(formData: FormData) {
  await requireRole("admin");
  const targetMarginBps = parsePercentToBps(field(formData, "margin"));
  const standardUpliftBps = parseMultiplierToBps(field(formData, "uplift"));
  const roundingStepCents = parseDollarsToCents(field(formData, "rounding"));
  if (targetMarginBps === null || standardUpliftBps === null || roundingStepCents === null) fail("global-format");
  try {
    validateSettings({ targetMarginBps, standardUpliftBps, roundingStepCents });
  } catch {
    fail("global-range");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("pricing_rules")
    .update({
      target_margin_bps: targetMarginBps,
      standard_uplift_bps: standardUpliftBps,
      rounding_step_cents: roundingStepCents,
    })
    .eq("scope", "global");
  if (error) fail("save");
  await publishTierPrices(supabase);
  done("global");
}

export async function saveTierMinRates(formData: FormData) {
  await requireRole("admin");
  const supabase = await createClient();
  const updates: { tier_slug: string; min_monthly_rate_cents: number }[] = [];

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("min_")) continue;
    const cents = parseDollarsToCents(String(value));
    if (cents === null) fail("tier-format");
    updates.push({ tier_slug: key.slice(4), min_monthly_rate_cents: cents });
  }

  const { error } = await supabase.from("tier_min_rates").upsert(updates, { onConflict: "tier_slug" });
  if (error) fail("save");
  await publishTierPrices(supabase);
  done("tiers");
}

export async function republishTierPrices() {
  await requireRole("admin");
  await publishTierPrices(await createClient());
  done("published");
}

// Adds or replaces the override for one niche role. Blank fields fall back
// to the global rule.
export async function saveRoleOverride(formData: FormData) {
  await requireRole("admin");
  const role = field(formData, "role");
  if (!isNiche(role)) fail("role");

  const marginInput = field(formData, "margin");
  const upliftInput = field(formData, "uplift");
  const roundingInput = field(formData, "rounding");
  const targetMarginBps = marginInput ? parsePercentToBps(marginInput) : null;
  const standardUpliftBps = upliftInput ? parseMultiplierToBps(upliftInput) : null;
  const roundingStepCents = roundingInput ? parseDollarsToCents(roundingInput) : null;

  if ((marginInput && targetMarginBps === null) || (upliftInput && standardUpliftBps === null) || (roundingInput && roundingStepCents === null)) {
    fail("override-format");
  }
  if (targetMarginBps === null && standardUpliftBps === null && roundingStepCents === null) fail("override-empty");
  try {
    validateSettings({
      targetMarginBps: targetMarginBps ?? 0,
      standardUpliftBps: standardUpliftBps ?? 10_000,
      roundingStepCents: roundingStepCents ?? 1,
    });
  } catch {
    fail("override-range");
  }

  const supabase = await createClient();
  const values = {
    target_margin_bps: targetMarginBps,
    standard_uplift_bps: standardUpliftBps,
    rounding_step_cents: roundingStepCents,
  };
  const { data: existing } = await supabase
    .from("pricing_rules")
    .select("id")
    .eq("scope", "role")
    .eq("scope_id", role)
    .maybeSingle();

  const { error } = existing
    ? await supabase.from("pricing_rules").update(values).eq("id", existing.id)
    : await supabase.from("pricing_rules").insert({ scope: "role", scope_id: role, ...values });
  if (error) fail("save");
  done("override");
}

export async function deleteOverride(formData: FormData) {
  await requireRole("admin");
  const id = Number(field(formData, "id"));
  if (!Number.isSafeInteger(id)) fail("save");
  const supabase = await createClient();
  const { error } = await supabase.from("pricing_rules").delete().eq("id", id).neq("scope", "global");
  if (error) fail("save");
  done("override-deleted");
}

// Blank setup or monthly price means "quoted".
export async function saveAddonPackages(formData: FormData) {
  await requireRole("admin");
  const supabase = await createClient();
  const slugs = new Set(
    [...formData.keys()].filter((k) => k.startsWith("setup_") || k.startsWith("monthly_")).map((k) => k.split("_").slice(1).join("_")),
  );

  for (const slug of slugs) {
    const setupInput = field(formData, `setup_${slug}`);
    const monthlyInput = field(formData, `monthly_${slug}`);
    const setupCents = setupInput ? parseDollarsToCents(setupInput) : null;
    const monthlyCents = monthlyInput ? parseDollarsToCents(monthlyInput) : null;
    if ((setupInput && setupCents === null) || (monthlyInput && monthlyCents === null)) fail("addon-format");

    const { error } = await supabase
      .from("addon_packages")
      .update({ setup_cents: setupCents, monthly_cents: monthlyCents })
      .eq("slug", slug);
    if (error) fail("save");
  }
  done("addons");
}
