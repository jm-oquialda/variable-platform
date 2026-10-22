// Landing page copy, taken from the plan (sections 3, 5 and 6).
// TODO(confirm): the rematch terms, perks and training schedule must match
// the updated client agreement before launch.

export const CORE_ROLES = [
  {
    slug: "executive-assistant",
    name: "Executive Assistant",
    does: "Inbox, calendar, travel, research, meeting prep and personal admin.",
    edge: "Drafts in your voice with AI, turns meeting notes into action items.",
  },
  {
    slug: "gtm-manager",
    name: "GTM Manager",
    does: "Owns the outbound plan: ICP, sequences, campaigns and pipeline reporting.",
    edge: "AI account research and personalization at scale.",
  },
  {
    slug: "gtm-engineer",
    name: "GTM Engineer",
    does: "Builds the outbound machine: enrichment, lead scoring, routing and cold email infrastructure.",
    edge: "Clay AI enrichment, AI research agents and workflow automation.",
  },
  {
    slug: "social-media-manager",
    name: "Social Media Manager",
    does: "Content calendar, posting, community and reporting.",
    edge: "Creates with AI assistants and builds agents for repurposing and reporting.",
  },
  {
    slug: "developer",
    name: "Developer",
    does: "Features, fixes, websites, internal tools and QA.",
    edge: "Works with AI coding agents, with careful code review.",
  },
  {
    slug: "bookkeeper",
    name: "Bookkeeper",
    does: "Categorizing, reconciliations, AP and AR, month-end close and reports.",
    edge: "AI receipt capture, categorization and anomaly checks.",
  },
];

export const TRAINING_WEEKS = [
  { week: "Week 1", focus: "How Silicon Valley startups work", detail: "Speed, ownership, async communication, Slack etiquette, end-of-day reports." },
  { week: "Week 2", focus: "Core tools", detail: "Google Workspace, Slack, Notion, HubSpot, Asana or Linear, Loom." },
  { week: "Week 3", focus: "AI tools", detail: "AI assistants, meeting notetakers, Zapier, Make and n8n, agent-building basics." },
  { week: "Week 4", focus: "Niche track and capstone", detail: "A role-specific track and a capstone project reviewed by Jhona." },
];

export const TIER_ROWS: { label: string; values: [string, string, string] }[] = [
  {
    label: "Best for",
    values: [
      "One clear workload: EA, support, bookkeeping, social",
      "Core team roles that need more ownership",
      "Senior EAs and high-skill niches like GTM engineering",
    ],
  },
  { label: "30-day Silicon Valley training", values: ["Included", "Included", "Included, plus niche track"] },
  { label: "Delegation kit", values: ["Kit", "Kit and kickoff call", "Kit and kickoff led by Jhona"] },
  {
    label: "Supervision",
    values: ["End-of-day reports, monthly check-in", "End-of-day plus weekly time and task report", "Weekly report plus monthly strategy review"],
  },
  {
    label: "Rematch guarantee",
    values: ["1 free rematch, first 30 days", "1 free rematch, first 60 days", "2 free rematches, first 90 days, priority shortlist"],
  },
];

export const TIER_NAMES = ["Essentials", "Professional", "Executive"] as const;

export const TALENT_PERKS = [
  { title: "Paid Philippine holidays", text: "Regular holidays are paid, so your hire never has to choose between rest and income." },
  { title: "HMO after one year", text: "Health coverage from month 13 of a continuous placement." },
  { title: "Ongoing AI training", text: "New tools and workflows for their niche, long after the first 30 days." },
];

export const FAQ = [
  {
    q: "How fast can I hire?",
    a: "Send a request and VAriable hand-picks 5 to 10 profiles for you, each with an intro video. You interview the ones you like and can hire in days.",
  },
  {
    q: "Can I hire part time?",
    a: "Yes. Essentials is available part time at 20 hours a week.",
  },
  {
    q: "Which hours do they work?",
    a: "Your business hours. VAriable covers Pacific and Eastern time.",
  },
  {
    q: "What if the fit is not right?",
    a: "Every tier includes a written rematch guarantee: a free rematch within 30, 60 or 90 days depending on the tier, a new shortlist within 5 business days, and no billing between the outgoing and incoming hire. The full conditions are in your agreement.",
  },
  {
    q: "How does the 6-month commitment work?",
    a: "Commit to 6 months for the lowest monthly price, billed monthly. Month to month is available after the first 90 days at the standard price.",
  },
  {
    q: "When do I start paying?",
    a: "No charge until your hire starts working.",
  },
];
