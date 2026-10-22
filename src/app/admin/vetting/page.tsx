import type { Metadata } from "next";
import Link from "next/link";
import { nicheName } from "@/lib/niches";
import { formatPacific } from "@/lib/requests-store";
import { createClient } from "@/lib/supabase/server";
import { VETTING_STATUS } from "@/lib/talent";
import { ACTIVE_STATUSES, ALL_STATUSES, countByStatus, daysSince, fullName, loadVettingQueue } from "@/lib/vetting-store";

export const metadata: Metadata = { title: "Vetting" };

const th = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-ink-mid";
const td = "px-3 py-3 align-top";

const FILTERS = [
  { value: "active", label: "In review" },
  ...ALL_STATUSES.filter((s) => !(ACTIVE_STATUSES as readonly string[]).includes(s)).map((s) => ({
    value: s,
    label: VETTING_STATUS[s].label,
  })),
];

export default async function VettingQueuePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "active" } = await searchParams;
  const filter = FILTERS.some((f) => f.value === status) ? status : "active";
  const statuses = filter === "active" ? ACTIVE_STATUSES : [filter];

  const supabase = await createClient();
  const [rows, counts] = await Promise.all([loadVettingQueue(supabase, statuses), countByStatus(supabase)]);
  const countFor = (value: string) =>
    value === "active" ? ACTIVE_STATUSES.reduce((n, s) => n + (counts[s] ?? 0), 0) : (counts[value] ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Vetting.</h1>
          <p className="mt-1 text-sm text-ink-mid">Applicants by status, oldest submission first.</p>
        </div>
        <Link href="/admin/funnel" className="text-sm underline">
          Funnel stats
        </Link>
      </div>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/admin/vetting?status=${f.value}`}
            aria-current={f.value === filter ? "page" : undefined}
            className={`border px-3 py-1.5 text-xs font-medium transition ${
              f.value === filter ? "border-ink bg-ink text-white" : "border-line bg-card hover:border-ink"
            }`}
          >
            {f.label} <span className={f.value === filter ? "text-white/60" : "text-ink-soft"}>{countFor(f.value)}</span>
          </Link>
        ))}
      </nav>

      <section className="border border-line bg-card">
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-ink-mid">Nobody here right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-line">
                <tr>
                  <th className={th}>Applicant</th>
                  <th className={th}>Role</th>
                  <th className={th}>Status</th>
                  <th className={th}>In status</th>
                  <th className={th}>Submitted (PT)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const days = daysSince(r.inStageSince ?? r.updated_at);
                  return (
                    <tr key={r.talent_id} className="border-b border-line last:border-0 hover:bg-band">
                      <td className={td}>
                        <Link href={`/admin/vetting/${r.talent_id}`} className="font-medium underline-offset-2 hover:underline">
                          {fullName(r)}
                        </Link>
                        {r.headline && <span className="block text-xs text-ink-mid">{r.headline}</span>}
                      </td>
                      <td className={td}>{r.niche ? nicheName(r.niche) : "-"}</td>
                      <td className={td}>{VETTING_STATUS[r.vetting_status]?.label ?? r.vetting_status}</td>
                      <td className={`${td} whitespace-nowrap ${days !== null && days >= 7 ? "font-semibold" : "text-ink-mid"}`}>
                        {days === null ? "-" : days === 0 ? "Today" : `${days} day${days === 1 ? "" : "s"}`}
                      </td>
                      <td className={`${td} whitespace-nowrap text-ink-mid`}>
                        {r.submitted_at ? formatPacific(r.submitted_at) : "Not yet"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
