import { PortalShell } from "@/components/PortalShell";
import { requireRole } from "@/lib/auth";

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("partner");
  return <PortalShell user={user}>{children}</PortalShell>;
}
