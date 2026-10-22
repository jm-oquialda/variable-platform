import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { eyebrow } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { formatCents } from "@/lib/pricing/format";
import { loadTiers } from "@/lib/pricing/store";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";
import { RequestForm, type TierOption } from "./RequestForm";

export const metadata: Metadata = { title: "Request talent" };

// Used when the database is not connected, so the form still renders.
const FALLBACK_TIERS: TierOption[] = [
  { slug: "essentials", name: "Essentials", fromPrice: null },
  { slug: "professional", name: "Professional", fromPrice: null },
  { slug: "executive", name: "Executive", fromPrice: null },
];

async function tierOptions(): Promise<TierOption[]> {
  if (!hasSupabaseEnv()) return FALLBACK_TIERS;
  try {
    const tiers = await loadTiers(createPublicClient());
    return tiers.map((t) => ({
      slug: t.slug,
      name: t.name,
      fromPrice: t.commitment_price_cents ? formatCents(t.commitment_price_cents) : null,
    }));
  } catch {
    return FALLBACK_TIERS;
  }
}

export default async function RequestPage() {
  const [tiers, user] = await Promise.all([
    tierOptions(),
    hasSupabaseEnv() ? getCurrentUser().catch(() => null) : null,
  ]);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 pb-24 pt-16 sm:px-6">
        <p className={eyebrow}>Request talent</p>
        <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">
          Tell VAriable who you need.
          <span className="block text-ink-soft">Matches arrive within days.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-ink/80">
          VAriable hand-picks 5 to 10 profiles for your role, each with an intro video and a note on why they fit. You
          interview the ones you like.
        </p>
        <div className="mt-12">
          <RequestForm
            tiers={tiers}
            defaults={{ contact_name: user?.fullName ?? undefined, contact_email: user?.email ?? undefined }}
          />
        </div>
      </main>
    </>
  );
}
