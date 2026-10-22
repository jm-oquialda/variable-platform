import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadOwnTalentProfile } from "@/lib/talent-store";

// Opens the signed-in talent's own resume through a short-lived signed link.
// The bucket is private, so there is no permanent public address.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "talent") return NextResponse.redirect(new URL("/login", request.url));

  const supabase = await createClient();
  const profile = await loadOwnTalentProfile(supabase, user.id);
  if (!profile?.resume_path) return NextResponse.redirect(new URL("/talent/profile", request.url));

  const { data, error } = await supabase.storage.from("resumes").createSignedUrl(profile.resume_path, 60);
  if (error || !data) return NextResponse.redirect(new URL("/talent/profile", request.url));
  return NextResponse.redirect(data.signedUrl);
}
