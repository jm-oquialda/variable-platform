// Niche roles VAriable places (plan section 3). The same list feeds the
// talent sign-up category, the client request form, the open roles board
// and per-role pricing overrides. Slugs are stored in the database, so
// never rename one; add a new slug instead.

export type Niche = {
  slug: string;
  name: string;
  group: "core" | "more";
};

export const NICHES: Niche[] = [
  { slug: "executive-assistant", name: "Executive Assistant", group: "core" },
  { slug: "gtm-manager", name: "GTM Manager", group: "core" },
  { slug: "gtm-engineer", name: "GTM Engineer", group: "core" },
  { slug: "social-media-manager", name: "Social Media Manager", group: "core" },
  { slug: "developer", name: "Developer / Software Engineer", group: "core" },
  { slug: "bookkeeper", name: "Bookkeeper", group: "core" },
  { slug: "sales-ops", name: "Sales Ops / CRM Admin", group: "more" },
  { slug: "customer-support", name: "Customer Support", group: "more" },
  { slug: "recruiting-coordinator", name: "Recruiting Coordinator", group: "more" },
  { slug: "marketing-ops", name: "Marketing Ops / Automation", group: "more" },
  { slug: "project-manager", name: "Project Manager", group: "more" },
  { slug: "data-analyst", name: "Data / Research Analyst", group: "more" },
  { slug: "medical-billing", name: "Medical Billing / Healthcare Admin", group: "more" },
  { slug: "paid-ads", name: "Paid Ads Specialist", group: "more" },
];

const BY_SLUG = new Map(NICHES.map((n) => [n.slug, n]));

export function nicheName(slug: string): string {
  return BY_SLUG.get(slug)?.name ?? slug;
}

export function isNiche(slug: string): boolean {
  return BY_SLUG.has(slug);
}
