import type { Metadata } from "next";
import Link from "next/link";
import { btnPrimary, eyebrow, input, notice } from "@/components/ui";
import { computeFunnel, MIN_APPLICANTS_FOR_CLAIM, STAGE_LABEL, STAGES, supportedClaim, windowMonths } from "@/lib/funnel";
import { formatBps } from "@/lib/pricing/format";
import { createClient } from "@/lib/supabase/server";
import { loadFunnelData } from "@/lib/vetting-store";
import { deletePastCounts, savePastCounts } from "./actions";

export const metadata: Metadata = { title: "Funnel" };

const SAVED: Record<string, string> = {
  counts: "Past counts saved.",
  deleted: "Past counts removed.",
};
const ERRORS: Record<string, string> = {
  month: "Choose a month.",
  source: "Enter where the applicants came from, for example OnlineJobs.ph.",
  count: "Counts are whole numbers, 0 or more.",
  applied: "Enter how many applied.",
  order: "No stage can be larger than the number who applied.",
  save: "Could not save. Try again.",
};

const th = "px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-ink-mid first:text-left";
const td = "px-3 py-2 text-right tabular-nums first:text-left";

function monthLabel(key: string) {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

export default async function FunnelPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const query = await searchParams;
  const now = new Date();
  const since = windowMonths(now)[0];
  const { events, historical } = await loadFunnelData(await createClient(), `${since}T00:00:00Z`);
  const funnel = computeFunnel(events, historical, now);
  const claim = supportedClaim(funnel.total);
  const max = Math.max(funnel.total.applied, 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Funnel.</h1>
          <p className="mt-1 text-sm text-ink-mid">
            Last 12 months, {monthLabel(funnel.since)} to now. Platform applicants plus past counts entered below.
          </p>
        </div>
        <Link href="/admin/vetting" className="text-sm underline">
          Vetting queue
        </Link>
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

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="border border-line bg-card p-6">
          <p className={eyebrow}>Stages</p>
          <ol className="mt-5 space-y-4">
            {STAGES.map((s) => (
              <li key={s}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{STAGE_LABEL[s]}</span>
                  <span className="tabular-nums">
                    <span className="font-semibold">{funnel.total[s].toLocaleString("en-US")}</span>
                    <span className="ml-2 text-xs text-ink-mid">
                      {funnel.platform[s]} platform · {funnel.historical[s]} past
                    </span>
                  </span>
                </div>
                <div className="mt-1.5 h-2 bg-band" aria-hidden>
                  <div className="h-2 bg-ink" style={{ width: `${(funnel.total[s] / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="border border-line bg-card p-6">
          <p className={eyebrow}>Acceptance rate</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight">
            {funnel.acceptanceBps === null ? "-" : formatBps(funnel.acceptanceBps, 2)}
          </p>
          <p className="text-sm text-ink-mid">
            {funnel.total.accepted} accepted of {funnel.total.applied} applied
          </p>
          <div className="mt-6 border-t border-line pt-5">
            <p className={eyebrow}>Claim the numbers support</p>
            <p className="mt-2 text-xl font-semibold">{claim.text}</p>
            <p className="mt-1 text-sm text-ink-mid">{claim.reason}</p>
            <p className="mt-3 text-xs text-ink-soft">
              Use a percentage only once at least {MIN_APPLICANTS_FOR_CLAIM} applicants are counted. US advertising rules
              expect claims like this to be provable.
            </p>
          </div>
        </section>
      </div>

      <section className="border border-line bg-card">
        <p className={`${eyebrow} px-6 pt-6`}>By month</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-line">
              <tr>
                <th className={th}>Month</th>
                {STAGES.map((s) => (
                  <th key={s} className={th}>
                    {STAGE_LABEL[s]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...funnel.months].reverse().map((m) => (
                <tr key={m.month} className="border-b border-line last:border-0">
                  <td className={td}>{monthLabel(m.month)}</td>
                  {STAGES.map((s) => (
                    <td key={s} className={td}>
                      {m.platform[s] + m.historical[s] || <span className="text-ink-soft">0</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border border-line bg-card p-6">
        <p className={eyebrow}>Past applicant counts</p>
        <p className="mt-2 max-w-2xl text-sm text-ink-mid">
          Applicants from before the platform, or from channels outside it, so the 12-month rate counts everyone. One row
          per month and source; saving the same month and source again replaces it.
        </p>
        <form action={savePastCounts} className="mt-5 grid gap-3 sm:grid-cols-[repeat(7,minmax(0,1fr))] sm:items-end">
          <label className="text-xs font-medium sm:col-span-1">
            Month
            <input name="month" type="month" required className={`${input} mt-1`} />
          </label>
          <label className="text-xs font-medium sm:col-span-1">
            Source
            <input name="source" required placeholder="OnlineJobs.ph" className={`${input} mt-1`} />
          </label>
          {STAGES.map((s) => (
            <label key={s} className="text-xs font-medium">
              {STAGE_LABEL[s]}
              <input name={s} inputMode="numeric" placeholder="0" required={s === "applied"} className={`${input} mt-1`} />
            </label>
          ))}
          <button type="submit" className={`${btnPrimary} sm:col-span-7 sm:justify-self-start`}>
            Save counts
          </button>
        </form>

        {historical.length > 0 && (
          <div className="mt-6 overflow-x-auto border-t border-line">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-line">
                <tr>
                  <th className={th}>Month</th>
                  <th className={`${th} !text-left`}>Source</th>
                  {STAGES.map((s) => (
                    <th key={s} className={th}>
                      {STAGE_LABEL[s]}
                    </th>
                  ))}
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody>
                {historical.map((h) => (
                  <tr key={`${h.month}-${h.source}`} className="border-b border-line last:border-0">
                    <td className={td}>{monthLabel(h.month)}</td>
                    <td className={`${td} !text-left`}>{h.source}</td>
                    {STAGES.map((s) => (
                      <td key={s} className={td}>
                        {h[s]}
                      </td>
                    ))}
                    <td className={td}>
                      <form action={deletePastCounts}>
                        <input type="hidden" name="month" value={h.month} />
                        <input type="hidden" name="source" value={h.source} />
                        <button type="submit" className="text-xs text-ink-mid underline hover:text-ink">
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
