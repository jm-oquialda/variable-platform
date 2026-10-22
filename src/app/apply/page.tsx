import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { btnPrimary, eyebrow } from "@/components/ui";
import { TALENT_PERKS } from "@/content/landing";
import { NICHES } from "@/lib/niches";

export const metadata: Metadata = {
  title: "Apply as talent",
  description: "Join VAriable and work with fast-growing US companies.",
};

const STEPS = [
  { n: "01", title: "Create your profile", text: "Your role, skills, experience, an intro video link and your resume." },
  { n: "02", title: "Get vetted", text: "Screening, a skills test and an interview with VAriable." },
  { n: "03", title: "Get matched", text: "VAriable introduces you to US companies that fit your skills and hours." },
  { n: "04", title: "Train and start", text: "Jhona's 30-day Silicon Valley training runs during your first month." },
];

const SIGN_UP = "/login?role=talent&next=/talent/profile";

export default function ApplyPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden border-b border-line">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,#ededed_0%,#ffffff_60%)]"
          />
          <div className="relative mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-28">
            <p className={eyebrow}>For talent</p>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.05] sm:text-6xl">
              <span className="block text-balance">Work with US startups.</span>
              <span className="block text-balance text-ink-soft">Grow with AI.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink/80">
              VAriable hand-picks Executive Assistants and AI-enabled specialists from the Philippines for fast-growing US
              companies, and trains every hire on how Silicon Valley works.
            </p>
            <Link href={SIGN_UP} className={`${btnPrimary} mt-10`}>
              Start your application <span aria-hidden>→</span>
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className={eyebrow}>How it works</p>
          <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Profile. Vetting. Match. Start.</h2>
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

        <section className="border-t border-line bg-band">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <p className={eyebrow}>Perks</p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Real support, not just a contract.</h2>
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

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className={eyebrow}>Roles</p>
          <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Roles VAriable places.</h2>
          <ul className="mt-8 flex flex-wrap gap-2">
            {NICHES.map((n) => (
              <li key={n.slug} className="border border-line px-3 py-1.5 text-sm">
                {n.name}
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-ink text-white">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
            <h2 className="text-3xl font-semibold sm:text-5xl">
              Ready to apply?
              <span className="block text-white/50">It starts with your email.</span>
            </h2>
            <Link
              href={SIGN_UP}
              className="mt-10 inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-ink transition hover:bg-white/85"
            >
              Start your application <span aria-hidden>→</span>
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
