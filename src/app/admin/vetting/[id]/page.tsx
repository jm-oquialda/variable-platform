import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { btnPrimary, eyebrow, input, notice } from "@/components/ui";
import { nicheName } from "@/lib/niches";
import { quote, resolveSettings } from "@/lib/pricing";
import { formatBps, formatCents } from "@/lib/pricing/format";
import { loadPricingRules } from "@/lib/pricing/store";
import { formatPacific } from "@/lib/requests-store";
import { createClient } from "@/lib/supabase/server";
import { OVERLAPS, TALENT_SCHEDULES, VETTING_STATUS } from "@/lib/talent";
import { resumeLabel } from "@/lib/talent-store";
import { ALL_STATUSES, fullName, loadApplicant } from "@/lib/vetting-store";
import { changeVettingStatus, saveScorecard } from "../actions";

export const metadata: Metadata = { title: "Applicant" };

const SAVED: Record<string, string> = {
  status: "Status updated.",
  scorecard: "Scorecard saved.",
};
const ERRORS: Record<string, string> = {
  status: "Choose a valid status.",
  score: "Scores are whole numbers from 1 to 5.",
  save: "Could not save. Try again.",
};

const SCORE_FIELDS = [
  { name: "communication", label: "Communication" },
  { name: "written_english", label: "Written English" },
  { name: "role_skills", label: "Role skills" },
  { name: "ai_tools", label: "AI tools" },
  { name: "reliability", label: "Reliability" },
] as const;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-line py-3 last:border-0 sm:grid-cols-[160px_1fr]">
      <dt className="text-xs uppercase tracking-[0.1em] text-ink-mid">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function ExternalLink({ href }: { href: string | null }) {
  if (!href) return <span className="text-ink-soft">-</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="break-all underline">
      {href}
    </a>
  );
}

export default async function ApplicantPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const [applicant, rules] = await Promise.all([loadApplicant(supabase, id), loadPricingRules(supabase)]);
  if (!applicant) notFound();

  const { profile: p, scorecard, events } = applicant;
  const status = VETTING_STATUS[p.vetting_status];
  const label = (list: readonly { value: string; label: string }[], v: string | null) =>
    list.find((x) => x.value === v)?.label ?? "-";

  // Rate view (admin only): what a client would pay for this person.
  const q = applicant.monthlyRateCents
    ? quote(applicant.monthlyRateCents, resolveSettings(rules, { role: p.niche ?? undefined }))
    : null;

  const scores = SCORE_FIELDS.map((f) => scorecard?.[f.name]).filter((s): s is number => typeof s === "number");
  const average = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : null;

  return (
    <div className="space-y-6">
      <Link href="/admin/vetting" className="text-sm text-ink-mid hover:text-ink">
        ← Vetting
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{fullName(p)}</h1>
          <p className="mt-1 text-ink-mid">
            {p.niche ? nicheName(p.niche) : "No role yet"}
            {p.headline ? ` · ${p.headline}` : ""}
          </p>
        </div>
        <span className="border border-ink px-3 py-1 text-xs font-medium uppercase tracking-[0.12em]">
          {status?.label ?? p.vetting_status}
        </span>
      </div>

      {query.saved && SAVED[query.saved] && (
        <p role="status" className={notice}>
          {SAVED[query.saved]}
        </p>
      )}
      {query.error && ERRORS[query.error] && (
        <p role="alert" className={notice}>
          {ERRORS[query.error]}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section className="border border-line bg-card p-6">
            <p className={eyebrow}>Profile</p>
            <dl className="mt-3">
              <Row label="Email">{applicant.email ?? "-"}</Row>
              <Row label="Phone">{p.phone ?? "-"}</Row>
              <Row label="City">{p.city ?? "-"}</Row>
              <Row label="Experience">{p.years_experience != null ? `${p.years_experience} years` : "-"}</Row>
              <Row label="Skills">{p.skills.length ? p.skills.join(", ") : "-"}</Row>
              <Row label="Tools">{p.tools.length ? p.tools.join(", ") : "-"}</Row>
              <Row label="Availability">
                {label(TALENT_SCHEDULES, p.schedule)} · {label(OVERLAPS, p.overlap)}
                {p.available_from ? ` · from ${p.available_from}` : ""}
              </Row>
              <Row label="Intro video">
                <ExternalLink href={p.intro_video_url} />
              </Row>
              <Row label="Portfolio">
                <ExternalLink href={p.portfolio_url} />
              </Row>
              <Row label="LinkedIn">
                <ExternalLink href={p.linkedin_url} />
              </Row>
              <Row label="Resume">
                {p.resume_path ? (
                  <a href={`/admin/vetting/${p.talent_id}/resume`} target="_blank" rel="noopener" className="underline">
                    {resumeLabel(p.resume_path)}
                  </a>
                ) : (
                  <span className="text-ink-soft">Not uploaded</span>
                )}
              </Row>
              <Row label="Privacy consent">{p.privacy_consent_at ? formatPacific(p.privacy_consent_at) + " PT" : "Not given"}</Row>
            </dl>
            {p.summary && (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-xs uppercase tracking-[0.1em] text-ink-mid">Summary</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{p.summary}</p>
              </div>
            )}
          </section>

          <section className="border border-line bg-card p-6">
            <p className={eyebrow}>Rate view · admin only</p>
            {q ? (
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div className="border border-line bg-band p-3">
                  <dt className="text-ink-mid">Asking rate</dt>
                  <dd className="mt-1 text-lg font-semibold">{formatCents(q.rateCents)}</dd>
                </div>
                <div className="border border-line bg-band p-3">
                  <dt className="text-ink-mid">6-month price</dt>
                  <dd className="mt-1 text-lg font-semibold">{formatCents(q.commitmentPriceCents)}</dd>
                  <dd className="text-xs text-ink-mid">keeps {formatBps(q.commitmentMarginBps)}</dd>
                </div>
                <div className="border border-line bg-band p-3">
                  <dt className="text-ink-mid">Month to month</dt>
                  <dd className="mt-1 text-lg font-semibold">{formatCents(q.standardPriceCents)}</dd>
                  <dd className="text-xs text-ink-mid">keeps {formatBps(q.standardMarginBps)}</dd>
                </div>
                <div className="border border-line bg-band p-3">
                  <dt className="text-ink-mid">VAriable keeps</dt>
                  <dd className="mt-1 text-lg font-semibold">{formatCents(q.commitmentPriceCents - q.rateCents)}</dd>
                  <dd className="text-xs text-ink-mid">per month, 6-month</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-sm text-ink-mid">No asking rate yet.</p>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="border border-line bg-card p-6">
            <p className={eyebrow}>Change status</p>
            <form action={changeVettingStatus} className="mt-4 space-y-3">
              <input type="hidden" name="talent_id" value={p.talent_id} />
              <select name="status" defaultValue={p.vetting_status} className={input} aria-label="New status">
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {VETTING_STATUS[s].label}
                  </option>
                ))}
              </select>
              <textarea name="note" rows={3} placeholder="Note for the history (optional)" className={input} aria-label="Note" />
              <button type="submit" className={btnPrimary}>
                Update status
              </button>
              <p className="text-xs text-ink-mid">The applicant sees the new status in their portal.</p>
            </form>
          </section>

          <section className="border border-line bg-card p-6">
            <div className="flex items-baseline justify-between">
              <p className={eyebrow}>Scorecard</p>
              {average && <span className="text-sm font-semibold">{average} / 5</span>}
            </div>
            <form action={saveScorecard} className="mt-4 space-y-3">
              <input type="hidden" name="talent_id" value={p.talent_id} />
              {SCORE_FIELDS.map((f) => (
                <label key={f.name} className="grid grid-cols-[1fr_6rem] items-center gap-4 text-sm">
                  {f.label}
                  <select name={f.name} defaultValue={scorecard?.[f.name] ?? ""} className={input}>
                    <option value="">-</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <textarea
                name="notes"
                rows={4}
                defaultValue={scorecard?.notes ?? ""}
                placeholder="Interview notes"
                className={input}
                aria-label="Scorecard notes"
              />
              <button type="submit" className={btnPrimary}>
                Save scorecard
              </button>
            </form>
          </section>

          <section className="border border-line bg-card p-6">
            <p className={eyebrow}>History</p>
            {events.length === 0 ? (
              <p className="mt-3 text-sm text-ink-mid">Not submitted yet.</p>
            ) : (
              <ol className="mt-3">
                {events.map((e) => (
                  <li key={e.id} className="border-b border-line py-3 text-sm last:border-0">
                    <span className="font-medium">{VETTING_STATUS[e.to_status]?.label ?? e.to_status}</span>
                    <span className="block text-xs text-ink-mid">
                      {formatPacific(e.created_at)} PT{e.actor_id === p.talent_id ? " · by applicant" : ""}
                    </span>
                    {e.note && <span className="mt-1 block whitespace-pre-line text-xs">{e.note}</span>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
