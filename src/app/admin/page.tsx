import Link from "next/link";

const CARDS = [
  { href: "/admin/requests", title: "Requests", text: "Talent requests and questions from the website." },
  { href: "/admin/vetting", title: "Vetting", text: "Applicants by status, profiles, scorecards and status changes." },
  { href: "/admin/funnel", title: "Funnel", text: "12-month funnel, acceptance rate, the claim it supports, and past counts." },
  {
    href: "/admin/pricing",
    title: "Pricing",
    text: "Margin, uplift, rounding, tier minimum rates, role overrides, AI Agent Build prices and a price check.",
  },
];

export default function AdminHome() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Back office.</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href} className="block border border-line bg-card p-6 transition hover:border-ink">
            <h2 className="text-lg font-semibold">{c.title}</h2>
            <p className="mt-1 text-sm text-ink-mid">{c.text}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
