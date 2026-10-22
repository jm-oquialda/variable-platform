import type { Metadata } from "next";
import { NICHES, nicheName } from "@/lib/niches";
import { quote, resolveSettings } from "@/lib/pricing";
import {
  bpsToMultiplier,
  centsToInput,
  formatBps,
  formatCents,
  parseDollarsToCents,
} from "@/lib/pricing/format";
import { loadAddonPackages, loadPricingRules, loadTierMinRates, loadTiers } from "@/lib/pricing/store";
import { createClient } from "@/lib/supabase/server";
import {
  deleteOverride,
  republishTierPrices,
  saveAddonPackages,
  saveGlobalRule,
  saveRoleOverride,
  saveTierMinRates,
} from "./actions";

export const metadata: Metadata = { title: "Pricing" };

const SAVED: Record<string, string> = {
  global: "Global rule saved. Public prices recalculated and published.",
  tiers: "Tier minimum rates saved. Public prices recalculated and published.",
  published: "Public prices recalculated and published.",
  override: "Role override saved.",
  "override-deleted": "Role override removed.",
  addons: "AI Agent Build prices saved.",
};

const ERRORS: Record<string, string> = {
  "global-format": "Enter the margin as a percent (45), the uplift as a multiplier (1.2) and the rounding step in dollars (5).",
  "global-range": "Margin must be below 100%, uplift at least 1, rounding step above $0.",
  "tier-format": "Enter each minimum rate in dollars, for example 800.",
  role: "Pick a role from the list.",
  "override-format": "Check the override values: percent, multiplier and dollars.",
  "override-empty": "Set at least one value for the override.",
  "override-range": "Margin must be below 100%, uplift at least 1, rounding step above $0.",
  "addon-format": "Enter add-on prices in dollars, or leave blank for quoted.",
  save: "Could not save. Try again.",
};

const input = "w-full rounded-md border border-line bg-card px-3 py-1.5 text-sm outline-none focus:border-accent";
const button = "rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90";
const th = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-ink-mid";
const td = "px-3 py-2 align-middle";

function Section({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-card p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-ink-mid">{intro}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; rate?: string; role?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const [rules, minRates, tiers, addons] = await Promise.all([
    loadPricingRules(supabase),
    loadTierMinRates(supabase),
    loadTiers(supabase),
    loadAddonPackages(supabase),
  ]);

  const global = resolveSettings(rules.filter((r) => r.scope === "global"));
  const overrides = rules.filter((r) => r.scope === "role");
  const publishedAt = tiers.find((t) => t.prices_published_at)?.prices_published_at;

  // Price check: what a client would pay for a given rate and role.
  const checkRate = params.rate ? parseDollarsToCents(params.rate) : null;
  const checkRole = params.role && NICHES.some((n) => n.slug === params.role) ? params.role : "";
  const checkSettings = resolveSettings(rules, { role: checkRole || undefined });
  const check = checkRate ? quote(checkRate, checkSettings) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pricing</h1>
        <p className="mt-1 text-sm text-ink-mid">
          Talent rates and margins on this page are admin only. Clients and visitors only ever see the calculated prices.
        </p>
      </div>

      {params.saved && SAVED[params.saved] && (
        <p role="status" className="rounded-md bg-accent-bg px-4 py-2 text-sm text-accent">
          {SAVED[params.saved]}
        </p>
      )}
      {params.error && ERRORS[params.error] && (
        <p role="alert" className="rounded-md bg-alert-bg px-4 py-2 text-sm text-alert">
          {ERRORS[params.error]}
        </p>
      )}

      <Section
        title="Public starting prices"
        intro="Each tier's public price is the lowest client price VAriable offers in it, calculated from the tier's minimum talent rate and the global rule. Saving publishes the new prices to the website."
      >
        <form action={saveTierMinRates}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="border-b border-line">
                <tr>
                  <th className={th}>Tier</th>
                  <th className={th}>Minimum talent rate / mo</th>
                  <th className={th}>6-month price</th>
                  <th className={th}>Month to month</th>
                  <th className={th}>Margin kept</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((tier) => {
                  const minRate = minRates.get(tier.slug);
                  const q = minRate ? quote(minRate, global) : null;
                  return (
                    <tr key={tier.slug} className="border-b border-line last:border-0">
                      <td className={`${td} font-medium`}>{tier.name}</td>
                      <td className={td}>
                        <div className="flex max-w-36 items-center gap-1">
                          <span className="text-ink-mid">$</span>
                          <input
                            name={`min_${tier.slug}`}
                            defaultValue={minRate ? centsToInput(minRate) : ""}
                            inputMode="decimal"
                            required
                            aria-label={`${tier.name} minimum talent rate`}
                            className={input}
                          />
                        </div>
                      </td>
                      <td className={td}>{q ? formatCents(q.commitmentPriceCents) : "-"}</td>
                      <td className={td}>{q ? formatCents(q.standardPriceCents) : "-"}</td>
                      <td className={`${td} text-ink-mid`}>
                        {q ? `${formatBps(q.commitmentMarginBps)} / ${formatBps(q.standardMarginBps)}` : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button type="submit" className={button}>
              Save and publish
            </button>
            <span className="text-xs text-ink-mid">
              {publishedAt
                ? `Website prices last published ${new Date(publishedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" })} PT.`
                : "Not published yet: the website shows no prices until you save or publish."}
            </span>
          </div>
        </form>
        {!publishedAt && (
          <form action={republishTierPrices} className="mt-3">
            <button type="submit" className="text-sm text-accent underline">
              Publish current prices now
            </button>
          </form>
        )}
      </Section>

      <Section
        title="Global rule"
        intro="Applies to every price unless a more specific override exists (client, then partner, then role, then global)."
      >
        <form action={saveGlobalRule} className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm">
            <span className="font-medium">Target margin (%)</span>
            <input name="margin" defaultValue={global.targetMarginBps / 100} inputMode="decimal" required className={`${input} mt-1`} />
            <span className="mt-1 block text-xs text-ink-mid">Measured against the client price. Plan floor: 45.</span>
          </label>
          <label className="text-sm">
            <span className="font-medium">Month-to-month uplift (x)</span>
            <input name="uplift" defaultValue={bpsToMultiplier(global.standardUpliftBps)} inputMode="decimal" required className={`${input} mt-1`} />
            <span className="mt-1 block text-xs text-ink-mid">Standard price = 6-month price x uplift.</span>
          </label>
          <label className="text-sm">
            <span className="font-medium">Round up to ($)</span>
            <input name="rounding" defaultValue={centsToInput(global.roundingStepCents)} inputMode="decimal" required className={`${input} mt-1`} />
            <span className="mt-1 block text-xs text-ink-mid">Always rounds up, so margin never drops below target.</span>
          </label>
          <div className="sm:col-span-3">
            <button type="submit" className={button}>
              Save and publish
            </button>
          </div>
        </form>
      </Section>

      <Section
        title="Overrides by role"
        intro="A different margin, uplift or rounding for one niche, for example developers. Blank fields use the global rule. Partner and client overrides arrive with partner and client records."
      >
        {overrides.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="border-b border-line">
                <tr>
                  <th className={th}>Role</th>
                  <th className={th}>Margin</th>
                  <th className={th}>Uplift</th>
                  <th className={th}>Round up to</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody>
                {overrides.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className={`${td} font-medium`}>{nicheName(r.scopeId ?? "")}</td>
                    <td className={td}>{r.targetMarginBps !== undefined ? formatBps(r.targetMarginBps, 2) : <span className="text-ink-mid">global</span>}</td>
                    <td className={td}>{r.standardUpliftBps !== undefined ? `${bpsToMultiplier(r.standardUpliftBps)}x` : <span className="text-ink-mid">global</span>}</td>
                    <td className={td}>{r.roundingStepCents !== undefined ? formatCents(r.roundingStepCents) : <span className="text-ink-mid">global</span>}</td>
                    <td className={`${td} text-right`}>
                      <form action={deleteOverride}>
                        <input type="hidden" name="id" value={r.id} />
                        <button type="submit" className="text-sm text-alert underline">
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-ink-mid">No overrides. Every role uses the global rule.</p>
        )}

        <form action={saveRoleOverride} className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end">
          <label className="text-sm">
            <span className="font-medium">Role</span>
            <select name="role" required defaultValue="" className={`${input} mt-1`}>
              <option value="" disabled>
                Choose a role
              </option>
              {NICHES.map((n) => (
                <option key={n.slug} value={n.slug}>
                  {n.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="font-medium">Margin (%)</span>
            <input name="margin" inputMode="decimal" placeholder="global" className={`${input} mt-1`} />
          </label>
          <label className="text-sm">
            <span className="font-medium">Uplift (x)</span>
            <input name="uplift" inputMode="decimal" placeholder="global" className={`${input} mt-1`} />
          </label>
          <label className="text-sm">
            <span className="font-medium">Round to ($)</span>
            <input name="rounding" inputMode="decimal" placeholder="global" className={`${input} mt-1`} />
          </label>
          <button type="submit" className={button}>
            Save override
          </button>
        </form>
      </Section>

      <Section
        title="Price check"
        intro="What a client pays for a talent rate, using the rule that applies to the role. Nothing is saved."
      >
        <form method="get" className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
          <label className="text-sm">
            <span className="font-medium">Talent rate / mo ($)</span>
            <input name="rate" defaultValue={params.rate ?? ""} inputMode="decimal" required className={`${input} mt-1`} />
          </label>
          <label className="text-sm">
            <span className="font-medium">Role</span>
            <select name="role" defaultValue={checkRole} className={`${input} mt-1`}>
              <option value="">Any role (global rule)</option>
              {NICHES.map((n) => (
                <option key={n.slug} value={n.slug}>
                  {n.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={button}>
            Check
          </button>
        </form>

        {params.rate && !check && <p className="mt-3 text-sm text-alert">Enter the rate in dollars, for example 800.</p>}
        {check && (
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="rounded-md bg-background p-3">
              <dt className="text-ink-mid">6-month price</dt>
              <dd className="mt-1 text-lg font-semibold">{formatCents(check.commitmentPriceCents)}</dd>
              <dd className="text-xs text-ink-mid">keeps {formatBps(check.commitmentMarginBps)}</dd>
            </div>
            <div className="rounded-md bg-background p-3">
              <dt className="text-ink-mid">Month to month</dt>
              <dd className="mt-1 text-lg font-semibold">{formatCents(check.standardPriceCents)}</dd>
              <dd className="text-xs text-ink-mid">keeps {formatBps(check.standardMarginBps)}</dd>
            </div>
            <div className="rounded-md bg-background p-3">
              <dt className="text-ink-mid">VAriable keeps / mo</dt>
              <dd className="mt-1 text-lg font-semibold">{formatCents(check.commitmentPriceCents - check.rateCents)}</dd>
              <dd className="text-xs text-ink-mid">on the 6-month price</dd>
            </div>
            <div className="rounded-md bg-background p-3">
              <dt className="text-ink-mid">Rule used</dt>
              <dd className="mt-1 text-sm">
                {formatBps(check.targetMarginBps, 2)} margin, {bpsToMultiplier(check.standardUpliftBps)}x, round to{" "}
                {formatCents(check.roundingStepCents)}
              </dd>
            </div>
          </dl>
        )}
      </Section>

      <Section
        title="Custom AI Agent Build"
        intro="Add-on prices shown on the website and in the request form. Leave a field blank to show it as quoted."
      >
        <form action={saveAddonPackages}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="border-b border-line">
                <tr>
                  <th className={th}>Package</th>
                  <th className={th}>One-time setup ($)</th>
                  <th className={th}>Monthly upkeep ($)</th>
                </tr>
              </thead>
              <tbody>
                {addons.map((a) => (
                  <tr key={a.slug} className="border-b border-line last:border-0">
                    <td className={td}>
                      <span className="font-medium">{a.name}</span>
                      <span className="block text-xs text-ink-mid">{a.description}</span>
                    </td>
                    <td className={td}>
                      <input
                        name={`setup_${a.slug}`}
                        defaultValue={a.setup_cents ? centsToInput(a.setup_cents) : ""}
                        placeholder="quoted"
                        inputMode="decimal"
                        aria-label={`${a.name} setup price`}
                        className={`${input} max-w-36`}
                      />
                    </td>
                    <td className={td}>
                      <input
                        name={`monthly_${a.slug}`}
                        defaultValue={a.monthly_cents ? centsToInput(a.monthly_cents) : ""}
                        placeholder="quoted"
                        inputMode="decimal"
                        aria-label={`${a.name} monthly price`}
                        className={`${input} max-w-36`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="submit" className={`${button} mt-4`}>
            Save add-on prices
          </button>
        </form>
      </Section>
    </div>
  );
}
