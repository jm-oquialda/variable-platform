import { ComingNext } from "@/components/PortalShell";

export default function AdminHome() {
  return (
    <ComingNext
      title="Back office"
      items={[
        "Pricing settings: target margin, uplift, rounding, tier minimum rates",
        "Vetting queue and funnel stats, including past applicant counts",
        "Requests board",
        "Rate view: talent rate vs client price vs margin",
      ]}
    />
  );
}
