import { PortalShell } from "@/components/PortalShell";
import { requireRole } from "@/lib/auth";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("client");
  return <PortalShell user={user}>{children}</PortalShell>;
}
