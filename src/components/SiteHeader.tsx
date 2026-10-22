import Link from "next/link";

// Public site header: sticky, translucent, hairline bottom border.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-[15px] font-semibold tracking-tight">
          VAriable
        </Link>
        <nav className="flex items-center gap-5 text-sm sm:gap-7">
          <Link href="/#how" className="hidden text-ink-mid hover:text-ink sm:inline">
            How it works
          </Link>
          <Link href="/#pricing" className="hidden text-ink-mid hover:text-ink sm:inline">
            Pricing
          </Link>
          <Link href="/login" className="text-ink-mid hover:text-ink">
            Sign in
          </Link>
          <Link
            href="/login"
            className="border border-line px-4 py-1.5 text-xs font-medium transition hover:border-ink"
          >
            Request talent
          </Link>
        </nav>
      </div>
    </header>
  );
}
