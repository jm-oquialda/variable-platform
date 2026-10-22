import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { QuestionRow, TalentRequestRow } from "@/lib/requests-store";

// Admin requests page and client portal, with the database replaced.

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));

const data = vi.hoisted(() => ({
  requests: [] as unknown[],
  questions: [] as unknown[],
}));

vi.mock("@/lib/requests-store", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/requests-store")>();
  return {
    ...real,
    loadTalentRequests: async () => data.requests,
    loadQuestions: async () => data.questions,
  };
});

const request = (o: Partial<TalentRequestRow> = {}): TalentRequestRow => ({
  id: "r1",
  created_at: "2026-10-22T17:30:00Z",
  client_id: null,
  contact_name: "Pat Kim",
  contact_email: "pat@acme.com",
  company: "Acme",
  company_website: null,
  niche: "gtm-engineer",
  tasks: "Build our Clay enrichment.",
  tools: "Clay, HubSpot",
  schedule: "part_time",
  time_zone: "eastern",
  tier_slug: "executive",
  commitment: "six_month",
  ai_agent_build: true,
  start_date: "2026-11-02",
  source: "website",
  partner_name: null,
  status: "new",
  ...o,
});

const question: QuestionRow = {
  id: "q1",
  created_at: "2026-10-22T18:00:00Z",
  name: "Sam",
  email: "sam@x.co",
  message: "Do you cover Eastern time?",
  handled: false,
};

describe("admin requests page", () => {
  it("lists requests with readable labels and questions", async () => {
    data.requests = [request(), request({ id: "r2", source: "partner", partner_name: "Flextroops", client_id: "c1", tier_slug: null })];
    data.questions = [question];
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Acme");
    expect(html).toContain("GTM Engineer");
    expect(html).toContain("Executive · Part time");
    expect(html).toContain("6-month commitment · Eastern (ET)");
    expect(html).toContain("+ AI Agent Build");
    expect(html).toContain("Partner: Flextroops");
    expect(html).toContain("Client account");
    expect(html).toContain("Not sure");
    expect(html).toContain("Oct 22, 2026, 10:30 AM"); // 17:30 UTC in Pacific time
    expect(html).toContain("Do you cover Eastern time?");
    expect(html).toContain("1 open");
  });

  it("shows empty states", async () => {
    data.requests = [];
    data.questions = [];
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("No requests yet.");
    expect(html).toContain("No questions yet.");
  });
});

describe("client portal", () => {
  it("shows the client's requests and status", async () => {
    data.requests = [request({ status: "matching" })];
    const { default: Page } = await import("@/app/client/page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("GTM Engineer");
    expect(html).toContain("Matching");
    expect(html).toContain("New request");
    expect(html).not.toContain("pat@acme.com");
  });

  it("invites a first request", async () => {
    data.requests = [];
    const { default: Page } = await import("@/app/client/page");
    expect(renderToStaticMarkup(await Page())).toContain("No requests yet.");
  });
});
