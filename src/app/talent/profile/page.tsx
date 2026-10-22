import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { centsToInput } from "@/lib/pricing/format";
import { createClient } from "@/lib/supabase/server";
import { loadOwnMonthlyRate, loadOwnTalentProfile, resumeLabel, type TalentProfileRow } from "@/lib/talent-store";
import { TalentProfileForm } from "./TalentProfileForm";

export const metadata: Metadata = { title: "Your profile" };

function toFormValues(p: TalentProfileRow | null, rateCents: number | null): Record<string, string> {
  const s = (x: string | number | null | undefined) => (x == null ? "" : String(x));
  return {
    first_name: s(p?.first_name),
    last_name: s(p?.last_name),
    phone: s(p?.phone),
    city: s(p?.city),
    niche: s(p?.niche),
    headline: s(p?.headline),
    years_experience: s(p?.years_experience),
    skills: (p?.skills ?? []).join(", "),
    tools: (p?.tools ?? []).join(", "),
    summary: s(p?.summary),
    portfolio_url: s(p?.portfolio_url),
    linkedin_url: s(p?.linkedin_url),
    intro_video_url: s(p?.intro_video_url),
    schedule: s(p?.schedule),
    overlap: s(p?.overlap),
    available_from: s(p?.available_from),
    monthly_rate: rateCents ? centsToInput(rateCents) : "",
  };
}

export default async function TalentProfilePage() {
  const user = await requireRole("talent");
  const supabase = await createClient();
  const [profile, rate] = await Promise.all([
    loadOwnTalentProfile(supabase, user.id),
    loadOwnMonthlyRate(supabase, user.id),
  ]);
  const submitted = (profile?.vetting_status ?? "draft") !== "draft";

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-semibold">
        Your profile.
        <span className="block text-ink-soft">{submitted ? "Keep it up to date." : "Save as you go, submit when ready."}</span>
      </h1>
      <p className="mt-4 max-w-2xl text-sm text-ink-mid">
        VAriable uses this profile to vet you and to match you with US clients. Fields marked optional can stay blank.
      </p>
      <div className="mt-8 border border-line bg-card px-5 sm:px-8">
        <TalentProfileForm
          initial={toFormValues(profile, rate)}
          submitted={submitted}
          resumeLabel={resumeLabel(profile?.resume_path ?? null)}
          hasConsent={!!profile?.privacy_consent_at}
        />
      </div>
    </div>
  );
}
