"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loadTiers } from "@/lib/pricing/store";
import { isLikelyBot, parseRequestForm, type FieldErrors } from "@/lib/requests";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";

export type RequestFormState = {
  errors?: FieldErrors;
  formError?: string;
  // What the person typed, so a failed submit keeps their answers.
  values?: Record<string, string>;
  // Increments on every submit; the form remounts on it so selects and
  // radios come back with the person's answers.
  attempt?: number;
};

const DEFAULT_TIER_SLUGS = ["essentials", "professional", "executive"];

// The earliest US calendar date right now (Hawaii), so a start date of
// "today" is accepted wherever in the US the person is.
function usToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Pacific/Honolulu" });
}

export async function submitTalentRequest(prev: RequestFormState, formData: FormData): Promise<RequestFormState> {
  const state = await handleSubmit(formData);
  return { ...state, attempt: (prev.attempt ?? 0) + 1 };
}

async function handleSubmit(formData: FormData): Promise<RequestFormState> {
  if (isLikelyBot(formData)) redirect("/request/thanks");

  const values = Object.fromEntries(
    [...formData.entries()].filter(([k, v]) => typeof v === "string" && !k.startsWith("$")),
  ) as Record<string, string>;

  const connected = hasSupabaseEnv();
  const tierSlugs = connected
    ? (await loadTiers(createPublicClient()).catch(() => [])).map((t) => t.slug)
    : DEFAULT_TIER_SLUGS;
  const parsed = parseRequestForm(formData, tierSlugs, usToday());
  if (!parsed.ok) return { values, errors: parsed.errors };

  if (!connected) {
    return { values, formError: "Requests are not connected yet. Email VAriable directly for now." };
  }

  // A signed-in client's request is linked to their account so it shows in
  // their portal. Everyone else submits as a visitor.
  const user = await getCurrentUser().catch(() => null);
  const supabase = await createClient();
  const { error } = await supabase
    .from("talent_requests")
    .insert({ ...parsed.data, client_id: user?.role === "client" ? user.id : null });

  if (error) {
    console.error("talent request insert failed", error.message);
    return { values, formError: "Your request could not be sent. Try again in a minute." };
  }

  redirect("/request/thanks");
}
