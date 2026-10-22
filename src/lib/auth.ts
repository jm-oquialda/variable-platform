import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "client" | "talent" | "partner";

export const ROLE_HOME: Record<AppRole, string> = {
  admin: "/admin",
  client: "/client",
  talent: "/talent",
  partner: "/partner",
};

export type CurrentUser = {
  id: string;
  email: string | null;
  role: AppRole;
  fullName: string | null;
};

// The signed-in user and their role, or null. The role comes from
// public.profiles, which the user can read but cannot change.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  return {
    id: user.id,
    email: user.email ?? null,
    role: profile.role as AppRole,
    fullName: profile.full_name,
  };
}

// Use at the top of a portal layout or page. Sends signed-out users to
// /login and users with another role to their own portal. This is for
// navigation only: row-level security is what protects the data.
export async function requireRole(...allowed: AppRole[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!allowed.includes(user.role)) redirect(ROLE_HOME[user.role]);
  return user;
}

// Only allow same-site relative paths after sign-in, never another host.
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}
