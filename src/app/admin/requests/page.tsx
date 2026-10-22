import type { Metadata } from "next";
import { eyebrow } from "@/components/ui";
import { describeRequest, formatPacific, loadQuestions, loadTalentRequests } from "@/lib/requests-store";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Requests" };

const th = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-ink-mid";
const td = "px-3 py-3 align-top";

// Read-only for now. Matching, notes and status changes come with the
// requests board.
export default async function RequestsPage() {
  const supabase = await createClient();
  const [requests, questions] = await Promise.all([loadTalentRequests(supabase), loadQuestions(supabase)]);
  const open = questions.filter((q) => !q.handled);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Requests.</h1>
        <p className="mt-1 text-sm text-ink-mid">Talent requests from the website and signed-in clients, newest first.</p>
      </div>

      <section className="border border-line bg-card">
        {requests.length === 0 ? (
          <p className="p-6 text-sm text-ink-mid">No requests yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-line">
                <tr>
                  <th className={th}>Received (PT)</th>
                  <th className={th}>Company</th>
                  <th className={th}>Role</th>
                  <th className={th}>Plan</th>
                  <th className={th}>Start</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  const d = describeRequest(r);
                  return (
                    <tr key={r.id} className="border-b border-line last:border-0">
                      <td className={`${td} whitespace-nowrap text-ink-mid`}>{formatPacific(r.created_at)}</td>
                      <td className={td}>
                        <span className="font-medium">{r.company}</span>
                        <span className="block text-xs text-ink-mid">
                          {r.contact_name} · {r.contact_email}
                        </span>
                        {r.client_id && <span className="mt-1 inline-block border border-line px-1.5 text-[10px] uppercase tracking-wide">Client account</span>}
                        {r.source === "partner" && (
                          <span className="mt-1 inline-block border border-line px-1.5 text-[10px] uppercase tracking-wide">
                            Partner{r.partner_name ? `: ${r.partner_name}` : ""}
                          </span>
                        )}
                      </td>
                      <td className={td}>
                        <span className="font-medium">{d.role}</span>
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-ink-mid">Tasks and tools</summary>
                          <p className="mt-2 max-w-sm whitespace-pre-line text-xs leading-relaxed">{r.tasks}</p>
                          {r.tools && <p className="mt-2 text-xs text-ink-mid">Tools: {r.tools}</p>}
                        </details>
                      </td>
                      <td className={td}>
                        {d.tier} · {d.schedule}
                        <span className="block text-xs text-ink-mid">
                          {d.commitment} · {d.timeZone}
                        </span>
                        {r.ai_agent_build && <span className="mt-1 block text-xs font-medium">+ AI Agent Build</span>}
                      </td>
                      <td className={`${td} whitespace-nowrap`}>{r.start_date ?? "-"}</td>
                      <td className={td}>{d.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <p className={eyebrow}>Questions from the website{open.length > 0 ? ` · ${open.length} open` : ""}</p>
        <div className="mt-3 border border-line bg-card">
          {questions.length === 0 ? (
            <p className="p-6 text-sm text-ink-mid">No questions yet.</p>
          ) : (
            <ul>
              {questions.map((q) => (
                <li key={q.id} className="border-b border-line p-5 last:border-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">
                      {q.name} <span className="font-normal text-ink-mid">· {q.email}</span>
                    </span>
                    <span className="text-xs text-ink-mid">
                      {formatPacific(q.created_at)} PT{q.handled ? " · handled" : ""}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{q.message}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
