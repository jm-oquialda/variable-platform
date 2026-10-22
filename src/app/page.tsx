import Link from "next/link";
import { PublicPricing } from "@/components/PublicPricing";

// Cached, refreshed hourly and immediately when admin saves pricing
// (revalidatePath("/") in admin/pricing/actions.ts).
export const revalidate = 3600;

// Placeholder. The real landing page is Phase 1, step 4.
export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16 sm:py-24">
      <p className="text-sm font-medium text-accent">VAriable</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">
        Executive Assistants and AI-trained specialists from the Philippines, hand-picked for US teams.
      </h1>
      <p className="mt-4 text-lg text-ink-mid">
        Every hire completes a 30-day Silicon Valley training before day one, backed by a written rematch guarantee.
      </p>
      <div className="mt-8">
        <Link href="/login" className="rounded-md bg-accent px-5 py-3 font-medium text-white hover:opacity-90">
          Sign in or get started
        </Link>
      </div>
      <PublicPricing />
    </main>
  );
}
