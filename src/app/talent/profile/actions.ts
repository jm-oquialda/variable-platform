"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { checkResume, parseTalentProfileForm, RESUME_TYPES, type TalentFieldErrors } from "@/lib/talent";
import { loadOwnTalentProfile } from "@/lib/talent-store";

export type TalentProfileState = {
  saved?: "draft" | "submitted";
  errors?: TalentFieldErrors;
  formError?: string;
  values?: Record<string, string>;
  attempt?: number;
};

function manilaToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

export async function saveTalentProfile(prev: TalentProfileState, formData: FormData): Promise<TalentProfileState> {
  const state = await handleSave(formData);
  return { ...state, attempt: (prev.attempt ?? 0) + 1 };
}

async function handleSave(formData: FormData): Promise<TalentProfileState> {
  const user = await requireRole("talent");
  const values = Object.fromEntries(
    [...formData.entries()].filter(([k, v]) => typeof v === "string" && !k.startsWith("$")),
  ) as Record<string, string>;

  const supabase = await createClient();
  const existing = await loadOwnTalentProfile(supabase, user.id);
  const wantsSubmit = formData.get("intent") === "submit" && (existing?.vetting_status ?? "draft") === "draft";

  const parsed = parseTalentProfileForm(formData, wantsSubmit ? "submit" : "draft", manilaToday());
  const errors: TalentFieldErrors = parsed.ok ? {} : { ...parsed.errors };

  const file = formData.get("resume");
  const upload = file instanceof File && file.size > 0 ? file : null;
  if (upload) {
    const problem = checkResume(upload);
    if (problem) errors.resume = problem;
  }
  if (wantsSubmit && !upload && !existing?.resume_path) errors.resume = "Upload your resume to submit.";

  if (!parsed.ok || Object.keys(errors).length > 0) return { values, errors };
  const { profile, monthlyRateCents, privacyConsent } = parsed.data;

  // Upload first, so a failed upload never leaves a profile pointing at
  // a missing file. The old file is removed only after the profile saves.
  let resumePath = existing?.resume_path ?? null;
  if (upload) {
    resumePath = `${user.id}/resume-${Date.now()}.${RESUME_TYPES[upload.type]}`;
    const { error } = await supabase.storage.from("resumes").upload(resumePath, upload, { contentType: upload.type });
    if (error) {
      console.error("resume upload failed", error.message);
      return { values, formError: "Your resume could not be uploaded. Try again." };
    }
  }

  const { error: profileError } = await supabase.from("talent_profiles").upsert(
    {
      talent_id: user.id,
      ...profile,
      resume_path: resumePath,
      privacy_consent_at: existing?.privacy_consent_at ?? (privacyConsent ? new Date().toISOString() : null),
      ...(wantsSubmit ? { vetting_status: "submitted" } : {}),
    },
    { onConflict: "talent_id" },
  );
  if (profileError) {
    console.error("talent profile save failed", profileError.message);
    if (upload && resumePath) await supabase.storage.from("resumes").remove([resumePath]);
    return { values, formError: "Your profile could not be saved. Try again." };
  }

  if (upload && existing?.resume_path && existing.resume_path !== resumePath) {
    await supabase.storage.from("resumes").remove([existing.resume_path]);
  }

  if (monthlyRateCents !== null) {
    const { error } = await supabase
      .from("talent_rates")
      .upsert({ talent_id: user.id, monthly_rate_cents: monthlyRateCents }, { onConflict: "talent_id" });
    if (error) {
      console.error("talent rate save failed", error.message);
      return { values, formError: "Your profile saved, but your rate did not. Try again." };
    }
  }

  revalidatePath("/talent", "layout");
  return { saved: wantsSubmit ? "submitted" : "draft" };
}
