import Link from "next/link";
import { btnPrimary } from "@/components/ui";
import { describeRequest, formatPacific, loadTalentRequests } from "@/lib/requests-store";
import { createClient } from "@/lib/supabase/server";

// Row-level security returns only this client's own requests.
export default async function ClientHome() {
  const requests = await loadTalentRequests(await createClient());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Your hiring.</h1>
          <p className="mt-1 text-sm text-ink-mid">Requests you have sent and where each one stands.</p>
        </div>
        <Link href="/request" className={btnPrimary}>
          New request <span aria-hidden>→</span>
        </Link>
      </div>

      {requests.length === 0 ? (
        <section className="border border-line bg-card p-8 text-center">
          <p className="font-semibold">No requests yet.</p>
          <p className="mt-1 text-sm text-ink-mid">Tell VAriable who you need and matching starts.</p>
        </section>
      ) : (
        <ul className="border-l border-t border-line bg-card">
          {requests.map((r) => {
            const d = describeRequest(r);
            return (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-r border-line p-5">
                <div>
                  <p className="font-semibold">{d.role}</p>
                  <p className="text-sm text-ink-mid">
                    {d.tier} · {d.schedule} · {d.commitment}
                    {r.ai_agent_build ? " · AI Agent Build" : ""}
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">Sent {formatPacific(r.created_at)} PT</p>
                </div>
                <span className="border border-line px-3 py-1 text-xs font-medium uppercase tracking-[0.12em]">
                  {d.status}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
