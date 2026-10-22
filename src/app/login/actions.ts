"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Sends a magic link. The role is only used when the email is new: the
// sign-up trigger accepts 'client' or 'talent' and ignores anything else.
export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const role = formData.get("role") === "talent" ? "talent" : "client";
  const next = safeNextPath(String(formData.get("next") ?? "")) ?? "/app";

  if (!email.includes("@")) redirect("/login?error=email");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      data: { role },
    },
  });

  if (error) redirect("/login?error=send");
  redirect("/login?sent=1");
}
