import Link from "next/link";
import { ComingNext } from "@/components/PortalShell";

export default function AdminHome() {
  return (
    <div className="space-y-6">
      <Link
        href="/admin/pricing"
        className="block rounded-lg border border-line bg-card p-6 hover:border-accent"
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
          "Requests board",
          "Rate view: talent rate vs client price vs margin",
        ]}
      />
    </div>
  );
}
