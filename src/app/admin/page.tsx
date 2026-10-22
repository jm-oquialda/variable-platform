import Link from "next/link";
import { ComingNext } from "@/components/PortalShell";

export default function AdminHome() {
  return (
    <div className="space-y-6">
      <Link
        href="/admin/requests"
        className="block border border-line bg-card p-6 transition hover:border-ink"
      >
        <h2 className="text-lg font-semibold">Requests</h2>
        <p className="mt-1 text-sm text-ink-mid">Talent requests and questions from the website.</p>
      </Link>
      <Link
        href="/admin/pricing"
        className="block border border-line bg-card p-6 transition hover:border-ink"
      >
        <h2 className="text-lg font-semibold">Pricing</h2>
        <p className="mt-1 text-sm text-ink-mid">
          Margin, uplift, rounding, tier minimum rates, role overrides, AI Agent Build prices and a price check.
        </p>
      </Link>
      <ComingNext
        title="Back office"
        items={[
          "Vetting queue and funnel stats, including past applicant counts",
          "Rate view: talent rate vs client price vs margin",
        ]}
      />
    </div>
  );
}
