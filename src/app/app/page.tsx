import { redirect } from "next/navigation";
import { getCurrentUser, ROLE_HOME } from "@/lib/auth";

// After sign-in everyone lands here and is sent to their own portal.
export default async function AppHome() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(ROLE_HOME[user.role]);
}
