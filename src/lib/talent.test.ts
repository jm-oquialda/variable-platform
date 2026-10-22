import { describe, expect, it } from "vitest";
import { checkResume, isVideoLink, normaliseUrl, parseList, parseTalentProfileForm } from "./talent";

const TODAY = "2026-10-22";

function form(overrides: Record<string, string | null> = {}) {
  const base: Record<string, string> = {
    first_name: "Ana",
    last_name: "Reyes",
    phone: "+63 917 555 0100",
    city: "Cebu",
    niche: "executive-assistant",
    headline: "EA for startup founders",
    years_experience: "5",
    skills: "Calendar management, Inbox zero, Travel",
    tools: "Google Workspace, Notion, Slack",
    summary: "Five years supporting founders across inbox, calendar, travel and investor updates.",
    portfolio_url: "anareyes.com",
    linkedin_url: "https://linkedin.com/in/anareyes",
    intro_video_url: "https://www.loom.com/share/abc123",
    schedule: "full_time",
    overlap: "pacific",
    available_from: "2026-11-01",
    monthly_rate: "800",
    privacy_consent: "on",
  };
  const fd = new FormData();
  for (const [k, v] of Object.entries({ ...base, ...overrides })) if (v !== null) fd.set(k, v);
  return fd;
}

describe("parseTalentProfileForm: submit", () => {
  it("accepts a complete profile and normalises it", () => {
    const r = parseTalentProfileForm(form(), "submit", TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.monthlyRateCents).toBe(80_000);
    expect(r.data.privacyConsent).toBe(true);
    expect(r.data.profile).toMatchObject({
      years_experience: 5,
      skills: ["Calendar management", "Inbox zero", "Travel"],
      portfolio_url: "https://anareyes.com/",
      intro_video_url: "https://www.loom.com/share/abc123",
    });
  });

  it.each([
    ["first_name", { first_name: "" }],
    ["phone", { phone: "" }],
    ["niche", { niche: "" }],
    ["headline", { headline: "" }],
    ["years_experience", { years_experience: "" }],
    ["skills", { skills: " , " }],
    ["summary", { summary: "Hi." }],
    ["intro_video_url", { intro_video_url: "" }],
    ["schedule", { schedule: "" }],
    ["overlap", { overlap: "" }],
    ["monthly_rate", { monthly_rate: "" }],
    ["privacy_consent", { privacy_consent: null }],
    ["available_from", { available_from: "2026-01-01" }],
  ])("requires %s", (field, overrides) => {
    const r = parseTalentProfileForm(form(overrides), "submit", TODAY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveProperty(field);
  });
});

describe("parseTalentProfileForm: draft", () => {
  it("saves a mostly empty draft", () => {
    const fd = new FormData();
    fd.set("first_name", "Ana");
    const r = parseTalentProfileForm(fd, "draft", TODAY);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.profile.first_name).toBe("Ana");
      expect(r.data.monthlyRateCents).toBeNull();
      expect(r.data.profile.skills).toEqual([]);
    }
  });

  it.each([
    ["niche", { niche: "astronaut" }],
    ["years_experience", { years_experience: "2.5" }],
    ["years_experience", { years_experience: "60" }],
    ["intro_video_url", { intro_video_url: "https://vimeo.com/123" }],
    ["portfolio_url", { portfolio_url: "not a url" }],
    ["monthly_rate", { monthly_rate: "8" }],
    ["monthly_rate", { monthly_rate: "80000" }],
    ["monthly_rate", { monthly_rate: "eight hundred" }],
  ])("still rejects a bad %s", (field, overrides) => {
    const r = parseTalentProfileForm(form(overrides), "draft", TODAY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveProperty(field);
  });

  it("allows a past available-from date in a draft", () => {
    expect(parseTalentProfileForm(form({ available_from: "2026-01-01" }), "draft", TODAY).ok).toBe(true);
  });
});

describe("helpers", () => {
  it("parseList trims, splits on commas and new lines, and drops duplicates", () => {
    expect(parseList("Clay, HubSpot\nclay,, Apollo ", 10)).toEqual(["Clay", "HubSpot", "Apollo"]);
    expect(parseList("a,b,c", 2)).toEqual(["a", "b"]);
  });

  it("normaliseUrl adds https and rejects non-web input", () => {
    expect(normaliseUrl("example.com/work")).toBe("https://example.com/work");
    expect(normaliseUrl("http://example.com")).toBe("http://example.com/");
    expect(normaliseUrl("javascript:alert(1)")).toBeNull();
    expect(normaliseUrl("localhost")).toBeNull();
    expect(normaliseUrl("")).toBeNull();
  });

  it("isVideoLink accepts Loom and YouTube only", () => {
    expect(isVideoLink("https://www.loom.com/share/x")).toBe(true);
    expect(isVideoLink("https://youtu.be/x")).toBe(true);
    expect(isVideoLink("https://www.youtube.com/watch?v=x")).toBe(true);
    expect(isVideoLink("https://vimeo.com/x")).toBe(false);
  });

  it("checkResume allows PDF and Word up to 5 MB", () => {
    expect(checkResume({ type: "application/pdf", size: 1_000_000 })).toBeNull();
    expect(checkResume({ type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 100 })).toBeNull();
    expect(checkResume({ type: "image/png", size: 100 })).toMatch(/PDF/);
    expect(checkResume({ type: "application/pdf", size: 6 * 1024 * 1024 })).toMatch(/5 MB/);
  });
});
