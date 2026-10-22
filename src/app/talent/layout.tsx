import { PortalShell } from "@/components/PortalShell";
import { requireRole } from "@/lib/auth";

export default async function TalentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("talent");
  return <PortalShell user={user}>{children}</PortalShell>;
}
