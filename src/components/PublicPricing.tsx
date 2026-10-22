import { formatCents } from "@/lib/pricing/format";
import { loadAddonPackages, loadTiers } from "@/lib/pricing/store";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";

// Public "starting at" prices (plan section 3). Reads only the published
// prices: talent rates and margins are never available here.
export async function PublicPricing() {
  if (!hasSupabaseEnv()) return null;

  let tiers, addons;
  try {
    const supabase = createPublicClient();
    [tiers, addons] = await Promise.all([loadTiers(supabase), loadAddonPackages(supabase)]);
  } catch {
    return null;
  }

  const published = tiers.filter((t) => t.commitment_price_cents && t.standard_price_cents);
  if (published.length === 0) return null;

  // Saving of the 6-month commitment vs month to month, from the first tier.
  const first = published[0];
  const savingPct = Math.round((1 - first.commitment_price_cents! / first.standard_price_cents!) * 100);
  const starter = addons.find((a) => a.setup_cents);

  return (
    <section aria-labelledby="pricing" className="mt-16">
      <h2 id="pricing" className="text-2xl font-semibold tracking-tight">
        Pricing
      </h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {published.map((tier) => (
          <div key={tier.slug} className="rounded-lg border border-line bg-card p-5">
            <h3 className="font-semibold">{tier.name}</h3>
            <p className="mt-3 text-sm text-ink-mid">Starting at</p>
            <p className="text-3xl font-semibold">
              {formatCents(tier.commitment_price_cents!)}
              <span className="text-base font-normal text-ink-mid">/mo</span>
            </p>
            <p className="text-xs text-ink-mid">with a 6-month commitment</p>
            <p className="mt-3 text-sm">
              {formatCents(tier.standard_price_cents!)}/mo <span className="text-ink-mid">month to month after 90 days</span>
            </p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-ink-mid">
        Save about {savingPct}% with a 6-month commitment. Part-time Essentials available. Final price depends on role and
        experience.
      </p>
      {starter && (
        <p className="mt-2 text-sm">
          <span className="font-medium">Custom AI Agent Build add-on:</span> from {formatCents(starter.setup_cents!)} setup
          {starter.monthly_cents ? ` + ${formatCents(starter.monthly_cents)}/mo upkeep` : ""}.
        </p>
      )}
    </section>
  );
}
