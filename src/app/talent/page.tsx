import { ComingNext } from "@/components/PortalShell";

export default function TalentHome() {
  return (
    <ComingNext
      title="Your profile"
      items={[
        "Niche category, skills, experience, portfolio, resume",
        "Intro video link (Loom or unlisted YouTube)",
        "Availability and your private asking rate",
        "Vetting status",
      ]}
    />
  );
}
