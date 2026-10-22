import Link from "next/link";
import { btnPrimary, btnSecondary, eyebrow } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { nicheName } from "@/lib/niches";
import { createClient } from "@/lib/supabase/server";
import { missingForSubmit, VETTING_STATUS } from "@/lib/talent";
import { loadOwnMonthlyRate, loadOwnTalentProfile } from "@/lib/talent-store";

const STEPS = ["draft", "submitted", "screening", "skills_test", "interview", "accepted"];

export default async function TalentHome() {
  const user = await requireRole("talent");
  const supabase = await createClient();
  const [profile, rate] = await Promise.all([
    loadOwnTalentProfile(supabase, user.id),
    loadOwnMonthlyRate(supabase, user.id),
  ]);

  const status = profile?.vetting_status ?? "draft";
  const info = VETTING_STATUS[status] ?? VETTING_STATUS.draft;
  const missing = missingForSubmit(profile, rate !== null, !!profile?.resume_path);
  const stepIndex = STEPS.indexOf(status);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">
          {profile?.first_name ? `Welcome, ${profile.first_name}.` : "Welcome to VAriable."}
        </h1>
        {profile?.niche && <p className="mt-1 text-ink-mid">{nicheName(profile.niche)}</p>}
      </div>

      <section className="border border-line bg-card p-6 sm:p-8">
        <p className={eyebrow}>Application status</p>
        <p className="mt-3 text-2xl font-semibold">{info.label}</p>
        <p className="mt-1 text-sm text-ink-mid">{info.text}</p>

        {stepIndex >= 0 && (
          <ol className="mt-6 grid grid-cols-3 gap-px border border-line bg-line text-[11px] uppercase tracking-[0.1em] sm:grid-cols-6">
            {STEPS.map((s, i) => (
              <li
                key={s}
                className={`px-3 py-2 ${i <= stepIndex ? "bg-ink text-white" : "bg-card text-ink-soft"}`}
                aria-current={i === stepIndex ? "step" : undefined}
              >
                {VETTING_STATUS[s].label}
              </li>
            ))}
          </ol>
        )}

        {status === "draft" && (
          <div className="mt-8">
            {missing.length > 0 ? (
              <>
                <p className="text-sm font-medium">Still to add before you submit</p>
                <ul className="mt-2 space-y-1 text-sm text-ink-mid">
                  {missing.map((m) => (
                    <li key={m} className="flex gap-2">
                      <span aria-hidden>○</span> {m}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm">Everything is in. Submit your profile for review.</p>
            )}
            <Link href="/talent/profile" className={`${btnPrimary} mt-6`}>
              {profile ? "Continue your profile" : "Start your profile"} <span aria-hidden>→</span>
            </Link>
          </div>
        )}

        {status !== "draft" && (
          <Link href="/talent/profile" className={`${btnSecondary} mt-8`}>
            View or edit your profile <span aria-hidden>→</span>
          </Link>
        )}
      </section>

      <section className="border border-line bg-card p-6">
        <p className={eyebrow}>What happens next</p>
        <p className="mt-3 text-sm leading-relaxed text-ink-mid">
          VAriable screens every profile, then may send a skills test and invite you to an interview. Accepted talent join
          the matching pool and complete Jhona&apos;s 30-day Silicon Valley training during their first month with a
          client.
        </p>
      </section>
    </div>
  );
}
