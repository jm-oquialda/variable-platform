import type { SupabaseClient } from "@supabase/supabase-js";
import { nicheName } from "./niches";
import { COMMITMENTS, SCHEDULES, TIME_ZONES } from "./requests";

// Reading talent requests and questions. Pass the signed-in user's client:
// admin sees everything, a client sees only their own requests.

export type TalentRequestRow = {
  id: string;
  created_at: string;
  client_id: string | null;
  contact_name: string;
  contact_email: string;
  company: string;
  company_website: string | null;
  niche: string;
  tasks: string;
  tools: string | null;
  schedule: string;
  time_zone: string;
  tier_slug: string | null;
  commitment: string;
  ai_agent_build: boolean;
  start_date: string | null;
  source: string;
  partner_name: string | null;
  status: string;
};

export type QuestionRow = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  message: string;
  handled: boolean;
};

export async function loadTalentRequests(supabase: SupabaseClient, limit = 200): Promise<TalentRequestRow[]> {
  const { data, error } = await supabase
    .from("talent_requests")
    .select(
      "id, created_at, client_id, contact_name, contact_email, company, company_website, niche, tasks, tools, schedule, time_zone, tier_slug, commitment, ai_agent_build, start_date, source, partner_name, status",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load requests: ${error.message}`);
  return data as TalentRequestRow[];
}

export async function loadQuestions(supabase: SupabaseClient, limit = 100): Promise<QuestionRow[]> {
  const { data, error } = await supabase
    .from("questions")
    .select("id, created_at, name, email, message, handled")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load questions: ${error.message}`);
  return data as QuestionRow[];
}

const label = (options: readonly { value: string; label: string }[], value: string) =>
  options.find((o) => o.value === value)?.label ?? value;

export const STATUS_LABEL: Record<string, string> = {
  new: "New",
  matching: "Matching",
  interviewing: "Interviewing",
  placed: "Placed",
  closed: "Closed",
};

export function describeRequest(r: TalentRequestRow) {
  return {
    role: nicheName(r.niche),
    schedule: label(SCHEDULES, r.schedule),
    timeZone: label(TIME_ZONES, r.time_zone),
    commitment: label(COMMITMENTS, r.commitment),
    tier: r.tier_slug ? r.tier_slug.charAt(0).toUpperCase() + r.tier_slug.slice(1) : "Not sure",
    status: STATUS_LABEL[r.status] ?? r.status,
  };
}

// Dates are stored in UTC; clients and admin read Pacific time.
export function formatPacific(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Los_Angeles",
  });
}
