import { PortalShell, type NavLink } from "@/components/PortalShell";
import { requireRole } from "@/lib/auth";

const NAV: NavLink[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/pricing", label: "Pricing" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("admin");
  return (
    <PortalShell user={user} nav={NAV}>
      {children}
    </PortalShell>
  );
}
