import { eyebrow } from "@/components/ui";
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
    <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-14 border-t border-line bg-band">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <p className={eyebrow}>Pricing</p>
        <h2 id="pricing-title" className="mt-3 text-3xl font-semibold sm:text-4xl">
          Simple monthly pricing.
        </h2>
        <p className="mt-3 max-w-2xl text-ink-mid">
          Save about {savingPct}% with a 6-month commitment. Part-time Essentials available. Final price depends on role
          and experience.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {published.map((tier) => (
            <div key={tier.slug} className="border border-line bg-card p-6">
              <h3 className="font-semibold">{tier.name}</h3>
              <p className="mt-6 text-xs uppercase tracking-[0.12em] text-ink-mid">Starting at</p>
              <p className="mt-1 text-4xl font-semibold tracking-tight">
                {formatCents(tier.commitment_price_cents!)}
                <span className="text-base font-normal text-ink-mid">/mo</span>
              </p>
              <p className="mt-1 text-xs text-ink-mid">with a 6-month commitment</p>
              <p className="mt-6 border-t border-line pt-4 text-sm">
                {formatCents(tier.standard_price_cents!)}/mo{" "}
                <span className="text-ink-mid">month to month after 90 days</span>
              </p>
            </div>
          ))}
        </div>
        {starter && (
          <p className="mt-6 text-sm">
            <span className="font-medium">Custom AI Agent Build add-on:</span>{" "}
            <a href="#ai-agents" className="text-ink-mid underline hover:text-ink">
              from {formatCents(starter.setup_cents!)} setup
            </a>
          </p>
        )}
      </div>
    </section>
  );
}
