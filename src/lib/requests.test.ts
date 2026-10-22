import { describe, expect, it } from "vitest";
import { HONEYPOT_FIELD, isLikelyBot, parseQuestionForm, parseRequestForm } from "./requests";

const TIERS = ["essentials", "professional", "executive"];
const TODAY = "2026-10-22";

function form(overrides: Record<string, string | null> = {}) {
  const base: Record<string, string> = {
    contact_name: "Pat Kim",
    contact_email: "Pat@Acme.com",
    company: "Acme",
    company_website: "acme.com",
    niche: "executive-assistant",
    tasks: "Inbox, calendar and travel for the CEO.",
    tools: "Google Workspace, Slack",
    schedule: "full_time",
    time_zone: "pacific",
    tier: "professional",
    commitment: "six_month",
    ai_agent_build: "on",
    start_date: "2026-11-02",
  };
  const fd = new FormData();
  for (const [k, v] of Object.entries({ ...base, ...overrides })) if (v !== null) fd.set(k, v);
  return fd;
}

describe("parseRequestForm", () => {
  it("accepts a complete request and normalises it", () => {
    const r = parseRequestForm(form(), TIERS, TODAY);
    expect(r).toEqual({
      ok: true,
      data: {
        contact_name: "Pat Kim",
        contact_email: "pat@acme.com",
        company: "Acme",
        company_website: "acme.com",
        niche: "executive-assistant",
        tasks: "Inbox, calendar and travel for the CEO.",
        tools: "Google Workspace, Slack",
        schedule: "full_time",
        time_zone: "pacific",
        tier_slug: "professional",
        commitment: "six_month",
        ai_agent_build: true,
        start_date: "2026-11-02",
      },
    });
  });

  it("treats optional fields as optional", () => {
    const r = parseRequestForm(
      form({ company_website: null, tools: "", tier: "unsure", ai_agent_build: null, start_date: "" }),
      TIERS,
      TODAY,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.company_website).toBeNull();
      expect(r.data.tools).toBeNull();
      expect(r.data.tier_slug).toBeNull();
      expect(r.data.ai_agent_build).toBe(false);
      expect(r.data.start_date).toBeNull();
    }
  });

  it.each([
    ["contact_name", { contact_name: "" }],
    ["contact_email", { contact_email: "pat-at-acme" }],
    ["company", { company: "  " }],
    ["niche", { niche: "astronaut" }],
    ["tasks", { tasks: "help" }],
    ["schedule", { schedule: "weekends" }],
    ["time_zone", { time_zone: "mars" }],
    ["tier_slug", { tier: "platinum" }],
    ["commitment", { commitment: "forever" }],
    ["start_date", { start_date: "2026-10-01" }],
    ["start_date", { start_date: "next week" }],
  ])("rejects a bad %s", (field, overrides) => {
    const r = parseRequestForm(form(overrides), TIERS, TODAY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveProperty(field);
  });

  it("reports every problem at once", () => {
    const r = parseRequestForm(new FormData(), TIERS, TODAY);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual(
        ["commitment", "company", "contact_email", "contact_name", "niche", "schedule", "tasks", "time_zone"].sort(),
      );
    }
  });

  it("accepts a start date of today", () => {
    expect(parseRequestForm(form({ start_date: TODAY }), TIERS, TODAY).ok).toBe(true);
  });
});

describe("isLikelyBot", () => {
  it("flags a filled honeypot", () => {
    expect(isLikelyBot(form({ [HONEYPOT_FIELD]: "555-0100" }))).toBe(true);
    expect(isLikelyBot(form())).toBe(false);
  });
});

describe("parseQuestionForm", () => {
  const q = (o: Record<string, string>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries({ name: "Sam", email: "sam@x.co", message: "Do you cover Eastern time?", ...o })) fd.set(k, v);
    return fd;
  };

  it("accepts a question", () => {
    expect(parseQuestionForm(q({}))).toEqual({
      ok: true,
      data: { name: "Sam", email: "sam@x.co", message: "Do you cover Eastern time?" },
    });
  });

  it("rejects missing fields", () => {
    const r = parseQuestionForm(q({ name: "", email: "x", message: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["email", "message", "name"]);
  });
});
