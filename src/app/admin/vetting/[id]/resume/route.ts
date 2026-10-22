import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Opens an applicant's resume for admin through a 60-second signed link.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return NextResponse.redirect(new URL("/login", request.url));

  const supabase = await createClient();
  const { data: profile } = await supabase.from("talent_profiles").select("resume_path").eq("talent_id", id).maybeSingle();
  const back = new URL(`/admin/vetting/${id}`, request.url);
  if (!profile?.resume_path) return NextResponse.redirect(back);

  const { data, error } = await supabase.storage.from("resumes").createSignedUrl(profile.resume_path, 60);
  if (error || !data) return NextResponse.redirect(back);
  return NextResponse.redirect(data.signedUrl);
}
