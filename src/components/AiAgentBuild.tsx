import { eyebrow } from "@/components/ui";
import { formatCents } from "@/lib/pricing/format";
import { loadAddonPackages, type AddonPackageRow } from "@/lib/pricing/store";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";

const EXAMPLES = ["Lead research", "Inbox triage", "Content repurposing", "Reporting"];

async function packages(): Promise<AddonPackageRow[]> {
  if (!hasSupabaseEnv()) return [];
  try {
    return await loadAddonPackages(createPublicClient());
  } catch {
    return [];
  }
}

function price(p: AddonPackageRow) {
  if (!p.setup_cents) return "Quoted";
  return `${formatCents(p.setup_cents)} setup${p.monthly_cents ? ` + ${formatCents(p.monthly_cents)}/mo` : ""}`;
}

// The Custom AI Agent Build add-on (plan section 3). Prices come from
// /admin/pricing; without them the section still explains the offer.
export async function AiAgentBuild() {
  const list = await packages();

  return (
    <section id="ai-agents" className="scroll-mt-14 border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-2">
        <div>
          <p className={eyebrow}>Add-on</p>
          <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
            Custom AI agents,
            <span className="block text-ink-soft">built by Jhona.</span>
          </h2>
          <p className="mt-5 leading-relaxed text-ink/80">
            Jhona designs and builds AI agents for your company&apos;s workflows. Your hire is trained to run them day to
            day. Available on top of any placement.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {EXAMPLES.map((x) => (
              <li key={x} className="border border-line px-3 py-1 text-xs text-ink-mid">
                {x}
              </li>
            ))}
          </ul>
        </div>
        {list.length > 0 && (
          <ul className="self-start border-l border-t border-line">
            {list.map((p) => (
              <li key={p.slug} className="flex items-baseline justify-between gap-6 border-b border-r border-line p-5">
                <span>
                  <span className="font-semibold">{p.name}</span>
                  <span className="block text-sm text-ink-mid">{p.description}</span>
                </span>
                <span className="shrink-0 text-right text-sm font-medium">{price(p)}</span>
              </li>
            ))}
            <li className="border-b border-r border-line p-5 text-xs text-ink-mid">
              Upkeep covers monitoring, fixes and small changes. Third-party AI and tool fees are billed at cost.
            </li>
          </ul>
        )}
      </div>
    </section>
  );
}
