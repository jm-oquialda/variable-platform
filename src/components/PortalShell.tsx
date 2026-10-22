import Link from "next/link";
import type { CurrentUser } from "@/lib/auth";

const ROLE_LABEL: Record<CurrentUser["role"], string> = {
  admin: "Admin",
  client: "Client portal",
  talent: "Talent portal",
  partner: "Partner portal",
};

export type NavLink = { href: string; label: string };

export function PortalShell({
  user,
  nav = [],
  children,
}: {
  user: CurrentUser;
  nav?: NavLink[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/app" className="font-semibold tracking-tight">
              VAriable
            </Link>
            <span className="rounded-full bg-accent-bg px-2 py-0.5 text-xs font-medium text-accent">
              {ROLE_LABEL[user.role]}
            </span>
            {nav.length > 0 && (
              <nav className="ml-2 flex gap-4 text-sm">
                {nav.map((link) => (
                  <Link key={link.href} href={link.href} className="text-ink-mid hover:text-ink">
                    {link.label}
                  </Link>
                ))}
              </nav>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-ink-mid sm:inline">{user.email}</span>
            <form action="/auth/signout" method="post">
              <button type="submit" className="text-ink-mid underline hover:text-ink">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

export function ComingNext({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-lg border border-line bg-card p-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-ink-mid">Coming in Phase 1:</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
