import Link from "next/link";
import { AiAgentBuild } from "@/components/AiAgentBuild";
import { PublicPricing } from "@/components/PublicPricing";
import { QuestionForm } from "@/components/QuestionForm";
import { SiteHeader } from "@/components/SiteHeader";
import { btnPrimary, btnSecondary, eyebrow } from "@/components/ui";
import { CORE_ROLES, FAQ, TALENT_PERKS, TIER_NAMES, TIER_ROWS, TRAINING_WEEKS } from "@/content/landing";
import { NICHES } from "@/lib/niches";

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

function SectionTitle({ label, title, sub }: { label: string; title: string; sub?: string }) {
  return (
    <>
      <p className={eyebrow}>{label}</p>
      <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
        {title}
        {sub && <span className="block text-ink-soft">{sub}</span>}
      </h2>
    </>
  );
}

export default function Home() {
  const moreRoles = NICHES.filter((n) => n.group === "more");

  return (
    <>
      <SiteHeader />
      <main>
        {/* Hero */}
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
              Every hire is personally trained by Jhona for 30 days on how Silicon Valley works, and backed by a
              written rematch guarantee. Reclaim your week in days, not months.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/request" className={btnPrimary}>
                Request talent <span aria-hidden>→</span>
              </Link>
              <Link href="#pricing" className={btnSecondary}>
                See pricing <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Proof strip */}
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

        {/* Roles */}
        <section id="roles" className="mx-auto max-w-6xl scroll-mt-14 px-4 py-20 sm:px-6 sm:py-24">
          <SectionTitle label="Roles" title="Specialists who already know AI." sub="Trained for the way US startups work." />
          <ul className="mt-10 grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-3">
            {CORE_ROLES.map((r) => (
              <li key={r.slug} className="border-b border-r border-line p-6">
                <h3 className="font-semibold">{r.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-mid">{r.does}</p>
                <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed">
                  <span className="uppercase tracking-[0.12em] text-ink-soft">AI edge</span>
                  <span className="mt-1 block text-ink/80">{r.edge}</span>
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-ink-mid">Also placing</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {moreRoles.map((n) => (
              <li key={n.slug} className="border border-line px-3 py-1 text-xs">
                {n.name}
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-14 border-t border-line bg-band">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
            <SectionTitle label="How it works" title="Request. Review. Interview. Start." />
            <ol className="mt-10 grid border-l border-t border-line bg-card sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s) => (
                <li key={s.n} className="border-b border-r border-line p-6">
                  <span className="text-xs text-ink-soft">{s.n}</span>
                  <h3 className="mt-6 font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-mid">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Training */}
        <section id="training" className="mx-auto max-w-6xl scroll-mt-14 px-4 py-20 sm:px-6 sm:py-24">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <SectionTitle label="Training" title="30 days of Silicon Valley." sub="Led by Jhona, in the first month." />
              <p className="mt-5 leading-relaxed text-ink/80">
                Every new hire learns how fast-moving US teams work: the speed, the tools, the culture and the AI. It runs
                during their first 30 days, outside your core hours, so your work keeps moving.
              </p>
            </div>
            <ol className="border-l border-t border-line">
              {TRAINING_WEEKS.map((w) => (
                <li key={w.week} className="grid gap-1 border-b border-r border-line p-5 sm:grid-cols-[100px_1fr]">
                  <span className="text-xs uppercase tracking-[0.12em] text-ink-soft">{w.week}</span>
                  <span>
                    <span className="font-semibold">{w.focus}</span>
                    <span className="mt-1 block text-sm text-ink-mid">{w.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Tier comparison */}
        <section id="tiers" className="scroll-mt-14 border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
            <SectionTitle label="Tiers" title="Three tiers. One standard." sub="Every hire is trained, supported and guaranteed." />
            <div className="mt-10 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="w-1/4 border-b border-line py-3 pr-4 text-left font-normal text-ink-mid"></th>
                    {TIER_NAMES.map((t) => (
                      <th key={t} className="border-b border-line px-4 py-3 text-left text-base font-semibold">
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TIER_ROWS.map((row) => (
                    <tr key={row.label}>
                      <th className="border-b border-line py-4 pr-4 text-left align-top text-xs font-medium uppercase tracking-[0.1em] text-ink-mid">
                        {row.label}
                      </th>
                      {row.values.map((v, i) => (
                        <td key={i} className="border-b border-line px-4 py-4 align-top leading-relaxed">
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <PublicPricing />
        <AiAgentBuild />

        {/* Talent perks */}
        <section className="border-t border-line bg-band">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <SectionTitle label="Why talent stay" title="Well-supported people stay." sub="That is continuity for you." />
              <Link href="/apply" className={btnSecondary}>
                Apply as talent <span aria-hidden>→</span>
              </Link>
            </div>
            <ul className="mt-10 grid border-l border-t border-line bg-card sm:grid-cols-3">
              {TALENT_PERKS.map((p) => (
                <li key={p.title} className="border-b border-r border-line p-6">
                  <h3 className="font-semibold">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-mid">{p.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ and question form */}
        <section id="faq" className="mx-auto max-w-6xl scroll-mt-14 px-4 py-20 sm:px-6 sm:py-24">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <SectionTitle label="FAQ" title="Questions, answered." />
              <div className="mt-8 border-t border-line">
                {FAQ.map((f) => (
                  <details key={f.q} className="group border-b border-line py-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                      {f.q}
                      <span aria-hidden className="text-ink-soft transition group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <p className="mt-3 text-sm leading-relaxed text-ink-mid">{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
            <div>
              <p className={eyebrow}>Ask</p>
              <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Something else?</h2>
              <p className="mt-3 text-ink-mid">Send a question and VAriable replies by email.</p>
              <div className="mt-8">
                <QuestionForm />
              </div>
            </div>
          </div>
        </section>

        {/* Closing call to action */}
        <section className="bg-ink text-white">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-24">
            <h2 className="text-3xl font-semibold sm:text-5xl">
              Reclaim your week.
              <span className="block text-white/50">Start with one request.</span>
            </h2>
            <Link
              href="/request"
              className="mt-10 inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-ink transition hover:bg-white/85"
            >
              Request talent <span aria-hidden>→</span>
            </Link>
          </div>
        </section>
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-10 text-xs text-ink-mid sm:px-6">
          <span>© 2026 VAriable</span>
          <span className="flex gap-6">
            <Link href="/request" className="hover:text-ink">
              Request talent
            </Link>
            <Link href="/apply" className="hover:text-ink">
              Apply as talent
            </Link>
            <Link href="/login" className="hover:text-ink">
              Sign in
            </Link>
          </span>
        </div>
      </footer>
    </>
  );
}
