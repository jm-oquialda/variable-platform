import { PortalShell, type NavLink } from "@/components/PortalShell";
import { requireRole } from "@/lib/auth";

const NAV: NavLink[] = [
  { href: "/talent", label: "Overview" },
  { href: "/talent/profile", label: "Profile" },
];

export default async function TalentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("talent");
  return (
    <PortalShell user={user} nav={NAV}>
      {children}
    </PortalShell>
  );
}
