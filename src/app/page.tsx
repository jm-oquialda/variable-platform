import Link from "next/link";
import { PublicPricing } from "@/components/PublicPricing";
import { SiteHeader } from "@/components/SiteHeader";
import { btnPrimary, btnSecondary, eyebrow } from "@/components/ui";

// Cached, refreshed hourly and immediately when admin saves pricing
// (revalidatePath("/") in admin/pricing/actions.ts).
export const revalidate = 3600;

const PROOF = [
  { value: "30 days", label: "Silicon Valley training" },
  { value: "Written", label: "Rematch guarantee" },
  { value: "PT + ET", label: "Time zone coverage" },
];

const STEPS = [
  { n: "01", title: "Request", text: "Describe the role, tools, hours and time zone." },
  { n: "02", title: "Review", text: "Get 5 to 10 hand-picked profiles, each with an intro video and why VAriable picked them." },
  { n: "03", title: "Interview", text: "Meet up to three people you like." },
  { n: "04", title: "Start", text: "Hire in days, with a delegation kit and kickoff call." },
];

// Placeholder sections. The full landing page is Phase 1, step 4.
export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden border-b border-line">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,#ededed_0%,#ffffff_60%)]"
          />
          <div className="relative mx-auto max-w-4xl px-4 pb-20 pt-20 text-center sm:px-6 sm:pb-28 sm:pt-28">
            <span className="inline-block border border-line bg-white/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-mid">
              Philippines · AI-trained · US teams
            </span>
            <h1 className="mt-8 text-4xl font-semibold leading-[1.05] sm:text-6xl">
              <span className="block text-balance">Executive Assistants and specialists,</span>
              <span className="block text-balance text-ink-soft">hand-picked for US teams.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink/80">
              Every hire completes a 30-day Silicon Valley training before day one, backed by a written rematch
              guarantee. Reclaim your week in days, not months.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/login" className={btnPrimary}>
                Request talent <span aria-hidden>→</span>
              </Link>
              <Link href="#pricing" className={btnSecondary}>
                See pricing <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="border-b border-line">
          <dl className="mx-auto grid max-w-4xl grid-cols-3 px-4 py-12 text-center sm:px-6">
            {PROOF.map((p) => (
              <div key={p.label} className="flex flex-col-reverse">
                <dt className="mt-1 text-[11px] uppercase tracking-[0.12em] text-ink-mid">{p.label}</dt>
                <dd className="text-xl font-semibold sm:text-2xl">{p.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="how" className="mx-auto max-w-6xl scroll-mt-14 px-4 py-20 sm:px-6 sm:py-24">
          <p className={eyebrow}>How it works</p>
          <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Request. Review. Interview. Start.</h2>
          <ol className="mt-10 grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n} className="border-b border-r border-line p-6">
                <span className="text-xs text-ink-soft">{s.n}</span>
                <h3 className="mt-6 font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-mid">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <PublicPricing />
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-10 text-xs text-ink-mid sm:px-6">© 2026 VAriable</div>
      </footer>
    </>
  );
}
