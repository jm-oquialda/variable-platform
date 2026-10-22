import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Applicant, QueueRow } from "@/lib/vetting-store";

// Admin vetting queue, applicant page and funnel page with the database replaced.

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("./actions", () => ({ changeVettingStatus: vi.fn(), saveScorecard: vi.fn() }));
vi.mock("@/app/admin/funnel/actions", () => ({ savePastCounts: vi.fn(), deletePastCounts: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/pricing/store", () => ({
  loadPricingRules: async () => [
    { id: 1, scope: "global", targetMarginBps: 4_500, standardUpliftBps: 12_000, roundingStepCents: 500 },
    { id: 2, scope: "role", scopeId: "developer", targetMarginBps: 4_000 },
  ],
}));

const data = vi.hoisted(() => ({
  queue: [] as unknown[],
  counts: {} as Record<string, number>,
  applicant: null as unknown,
  events: [] as unknown[],
  historical: [] as unknown[],
}));

vi.mock("@/lib/vetting-store", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/vetting-store")>();
  return {
    ...real,
    loadVettingQueue: async () => data.queue,
    countByStatus: async () => data.counts,
    loadApplicant: async () => data.applicant,
    loadFunnelData: async () => ({ events: data.events, historical: data.historical }),
  };
});

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

const row = (o: Partial<QueueRow> = {}): QueueRow => ({
  talent_id: "11111111-1111-1111-1111-111111111111",
  first_name: "Ana",
  last_name: "Reyes",
  niche: "developer",
  headline: "Full-stack developer",
  vetting_status: "screening",
  submitted_at: daysAgo(10),
  updated_at: daysAgo(9),
  inStageSince: daysAgo(9),
  ...o,
});

const applicant: Applicant = {
  profile: {
    talent_id: "11111111-1111-1111-1111-111111111111",
    first_name: "Ana",
    last_name: "Reyes",
    phone: "+63 917 555 0100",
    city: "Cebu",
    niche: "developer",
    headline: "Full-stack developer",
    years_experience: 6,
    skills: ["React", "Supabase"],
    tools: ["GitHub"],
    summary: "Six years building web apps for US startups.",
    portfolio_url: "https://ana.dev/",
    linkedin_url: null,
    intro_video_url: "https://www.loom.com/share/abc",
    schedule: "full_time",
    overlap: "pacific",
    available_from: null,
    resume_path: "11111111-1111-1111-1111-111111111111/resume-1.pdf",
    vetting_status: "interview",
    submitted_at: daysAgo(10),
    privacy_consent_at: daysAgo(10),
  },
  email: "ana@example.com",
  monthlyRateCents: 100_000,
  scorecard: {
    communication: 5,
    written_english: 4,
    role_skills: null,
    ai_tools: null,
    reliability: null,
    notes: "Clear and quick.",
    updated_at: daysAgo(1),
  },
  events: [
    { id: 2, from_status: "submitted", to_status: "interview", note: "Strong portfolio", actor_id: "admin", created_at: daysAgo(2) },
    { id: 1, from_status: null, to_status: "submitted", note: null, actor_id: "11111111-1111-1111-1111-111111111111", created_at: daysAgo(10) },
  ],
};

describe("vetting queue", () => {
  it("lists applicants with role, status and time in status", async () => {
    data.queue = [row(), row({ talent_id: "2", first_name: null, last_name: null, inStageSince: daysAgo(0), vetting_status: "submitted" })];
    data.counts = { submitted: 1, screening: 1, accepted: 3 };
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Ana Reyes");
    expect(html).toContain("Developer / Software Engineer");
    expect(html).toContain("9 days");
    expect(html).toContain("Today");
    expect(html).toContain("Unnamed applicant");
    expect(html).toMatch(/In review <span[^>]*>2</);
    expect(html).toMatch(/Accepted <span[^>]*>3</);
  });

  it("shows an empty state", async () => {
    data.queue = [];
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ status: "rejected" }) }));
    expect(html).toContain("Nobody here right now.");
    expect(html).toMatch(/aria-current="page"[^>]*>Not selected/);
  });
});

describe("applicant page", () => {
  async function render(query: Record<string, string> = {}) {
    data.applicant = applicant;
    const { default: Page } = await import("./[id]/page");
    return renderToStaticMarkup(
      await Page({ params: Promise.resolve({ id: applicant.profile.talent_id }), searchParams: Promise.resolve(query) }),
    );
  }

  it("shows contact details, links and resume for admin", async () => {
    const html = await render();
    expect(html).toContain("ana@example.com");
    expect(html).toContain("+63 917 555 0100");
    expect(html).toContain("https://www.loom.com/share/abc");
    expect(html).toContain("/admin/vetting/11111111-1111-1111-1111-111111111111/resume");
  });

  it("prices the asking rate with the role override", async () => {
    // $1,000 at the 40% developer override: $1,670 / $2,005
    const html = await render();
    expect(html).toContain("$1,000");
    expect(html).toContain("$1,670");
    expect(html).toContain("$2,005");
    expect(html).toContain("$670");
  });

  it("shows the scorecard average and history with notes", async () => {
    const html = await render();
    expect(html).toContain("4.5 / 5");
    expect(html).toContain("Clear and quick.");
    expect(html).toContain("Strong portfolio");
    expect(html).toContain("by applicant");
  });

  it("shows confirmations", async () => {
    expect(await render({ saved: "status" })).toContain("Status updated.");
  });

  it("404s for an unknown applicant", async () => {
    data.applicant = null;
    const { default: Page } = await import("./[id]/page");
    await expect(Page({ params: Promise.resolve({ id: "x" }), searchParams: Promise.resolve({}) })).rejects.toThrow("NOT_FOUND");
  });
});

describe("funnel page", () => {
  it("combines platform and past counts and states the supported claim", async () => {
    const month = new Date().toISOString().slice(0, 7) + "-01";
    data.events = [
      { talent_id: "a", to_status: "submitted", created_at: daysAgo(0) },
      { talent_id: "a", to_status: "accepted", created_at: daysAgo(0) },
    ];
    data.historical = [
      { month, source: "OnlineJobs.ph", applied: 499, screened: 100, tested: 40, interviewed: 20, accepted: 4 },
    ];
    const { default: Page } = await import("@/app/admin/funnel/page");
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("5 accepted of 500 applied");
    expect(html).toContain("1.00%");
    expect(html).toContain("Top 1% of applicants");
    expect(html).toContain("OnlineJobs.ph");
    expect(html).toContain("1 platform · 499 past");
  });

  it("says hand-selected with too few applicants", async () => {
    data.events = [];
    data.historical = [];
    const { default: Page } = await import("@/app/admin/funnel/page");
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Hand-selected");
    expect(html).toContain("0 accepted of 0 applied");
  });
});
