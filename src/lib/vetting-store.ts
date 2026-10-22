import type { SupabaseClient } from "@supabase/supabase-js";
import type { HistoricalCount, VettingEvent } from "./funnel";
import type { TalentProfileRow } from "./talent-store";

// Admin-only reads for vetting and the funnel. Row-level security returns
// nothing to anyone else.

export const ACTIVE_STATUSES = ["submitted", "screening", "skills_test", "interview"] as const;
export const ALL_STATUSES = ["draft", ...ACTIVE_STATUSES, "accepted", "rejected", "paused"] as const;

export type QueueRow = {
  talent_id: string;
  first_name: string | null;
  last_name: string | null;
  niche: string | null;
  headline: string | null;
  vetting_status: string;
  submitted_at: string | null;
  updated_at: string;
  inStageSince: string | null;
};

export async function loadVettingQueue(supabase: SupabaseClient, statuses: readonly string[]): Promise<QueueRow[]> {
  const { data, error } = await supabase
    .from("talent_profiles")
    .select("talent_id, first_name, last_name, niche, headline, vetting_status, submitted_at, updated_at")
    .in("vetting_status", statuses as string[])
    .order("submitted_at", { ascending: true, nullsFirst: false })
    .limit(500);
  if (error) throw new Error(`Could not load the vetting queue: ${error.message}`);
  const rows = data as Omit<QueueRow, "inStageSince">[];
  if (rows.length === 0) return [];

  // When each applicant entered their current status.
  const { data: events, error: eventsError } = await supabase
    .from("vetting_events")
    .select("talent_id, to_status, created_at")
    .in("talent_id", rows.map((r) => r.talent_id))
    .order("created_at", { ascending: false });
  if (eventsError) throw new Error(`Could not load vetting history: ${eventsError.message}`);
  const latest = new Map<string, string>();
  for (const e of events as VettingEvent[]) {
    if (!latest.has(e.talent_id)) latest.set(e.talent_id, e.created_at);
  }
  return rows.map((r) => ({ ...r, inStageSince: latest.get(r.talent_id) ?? null }));
}

export async function countByStatus(supabase: SupabaseClient): Promise<Record<string, number>> {
  const { data, error } = await supabase.from("talent_profiles").select("vetting_status");
  if (error) throw new Error(`Could not count applicants: ${error.message}`);
  const counts: Record<string, number> = {};
  for (const r of data as { vetting_status: string }[]) counts[r.vetting_status] = (counts[r.vetting_status] ?? 0) + 1;
  return counts;
}

export type Scorecard = {
  communication: number | null;
  written_english: number | null;
  role_skills: number | null;
  ai_tools: number | null;
  reliability: number | null;
  notes: string | null;
  updated_at: string | null;
};

export type EventRow = {
  id: number;
  from_status: string | null;
  to_status: string;
  note: string | null;
  actor_id: string | null;
  created_at: string;
};

export type Applicant = {
  profile: TalentProfileRow;
  email: string | null;
  monthlyRateCents: number | null;
  scorecard: Scorecard | null;
  events: EventRow[];
};

export async function loadApplicant(supabase: SupabaseClient, talentId: string): Promise<Applicant | null> {
  const [profile, account, rate, scorecard, events] = await Promise.all([
    supabase.from("talent_profiles").select("*").eq("talent_id", talentId).maybeSingle(),
    supabase.from("profiles").select("email").eq("id", talentId).maybeSingle(),
    supabase.from("talent_rates").select("monthly_rate_cents").eq("talent_id", talentId).maybeSingle(),
    supabase
      .from("vetting_scorecards")
      .select("communication, written_english, role_skills, ai_tools, reliability, notes, updated_at")
      .eq("talent_id", talentId)
      .maybeSingle(),
    supabase
      .from("vetting_events")
      .select("id, from_status, to_status, note, actor_id, created_at")
      .eq("talent_id", talentId)
      .order("created_at", { ascending: false }),
  ]);
  for (const r of [profile, account, rate, scorecard, events]) {
    if (r.error) throw new Error(`Could not load the applicant: ${r.error.message}`);
  }
  if (!profile.data) return null;
  return {
    profile: profile.data as TalentProfileRow,
    email: account.data?.email ?? null,
    monthlyRateCents: rate.data?.monthly_rate_cents ?? null,
    scorecard: scorecard.data as Scorecard | null,
    events: events.data as EventRow[],
  };
}

// Events since the start of the funnel window, plus every past count.
export async function loadFunnelData(
  supabase: SupabaseClient,
  since: string,
): Promise<{ events: VettingEvent[]; historical: HistoricalCount[] }> {
  const [events, historical] = await Promise.all([
    supabase.from("vetting_events").select("talent_id, to_status, created_at").gte("created_at", since),
    supabase
      .from("historical_funnel_counts")
      .select("month, source, applied, screened, tested, interviewed, accepted")
      .order("month", { ascending: false })
      .order("source"),
  ]);
  if (events.error) throw new Error(`Could not load vetting events: ${events.error.message}`);
  if (historical.error) throw new Error(`Could not load past counts: ${historical.error.message}`);
  return { events: events.data as VettingEvent[], historical: historical.data as HistoricalCount[] };
}

// "Ana Reyes" for admin; clients will only ever get "Ana R." from the
// matching view.
export function fullName(p: { first_name: string | null; last_name: string | null }) {
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unnamed applicant";
}

export function daysSince(iso: string | null, now = new Date()) {
  if (!iso) return null;
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000));
}
