"use server";

import { isLikelyBot, parseQuestionForm } from "@/lib/requests";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";

export type QuestionFormState = {
  sent?: boolean;
  errors?: Partial<Record<"name" | "email" | "message", string>>;
  formError?: string;
  values?: Record<string, string>;
  attempt?: number;
};

// "Ask a question" on the landing page. Stored for admin; nobody else can
// read questions back.
export async function askQuestion(prev: QuestionFormState, formData: FormData): Promise<QuestionFormState> {
  const attempt = (prev.attempt ?? 0) + 1;
  if (isLikelyBot(formData)) return { sent: true, attempt };

  const values = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    message: String(formData.get("message") ?? ""),
  };
  const parsed = parseQuestionForm(formData);
  if (!parsed.ok) return { errors: parsed.errors, values, attempt };

  if (!hasSupabaseEnv()) {
    return { values, attempt, formError: "Questions are not connected yet. Email VAriable directly for now." };
  }

  const { error } = await createPublicClient().from("questions").insert(parsed.data);
  if (error) {
    console.error("question insert failed", error.message);
    return { values, attempt, formError: "Your question could not be sent. Try again in a minute." };
  }
  return { sent: true, attempt };
}
