import type { SupabaseClient } from "@supabase/supabase-js";
import type { TalentProfileInput } from "./talent";

// Reading a talent's own profile and private rate. Pass the signed-in
// user's client: row-level security returns only their own rows.

export type TalentProfileRow = TalentProfileInput & {
  talent_id: string;
  resume_path: string | null;
  vetting_status: string;
  submitted_at: string | null;
  privacy_consent_at: string | null;
  // Admin-facing; not selected for the talent's own pages.
  privacy_consent_source?: "platform" | "application_form" | null;
  external_ref?: string | null;
};

const COLUMNS =
  "talent_id, first_name, last_name, phone, city, niche, headline, years_experience, skills, tools, summary, portfolio_url, linkedin_url, intro_video_url, schedule, overlap, available_from, resume_path, vetting_status, submitted_at, privacy_consent_at";

export async function loadOwnTalentProfile(supabase: SupabaseClient, talentId: string): Promise<TalentProfileRow | null> {
  const { data, error } = await supabase.from("talent_profiles").select(COLUMNS).eq("talent_id", talentId).maybeSingle();
  if (error) throw new Error(`Could not load your profile: ${error.message}`);
  return data as TalentProfileRow | null;
}

export async function loadOwnMonthlyRate(supabase: SupabaseClient, talentId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("talent_rates")
    .select("monthly_rate_cents")
    .eq("talent_id", talentId)
    .maybeSingle();
  if (error) throw new Error(`Could not load your rate: ${error.message}`);
  return data?.monthly_rate_cents ?? null;
}

// "<talent id>/resume-1729...pdf" -> "resume.pdf"
export function resumeLabel(path: string | null) {
  if (!path) return null;
  const ext = path.split(".").pop();
  return `resume.${ext}`;
}
