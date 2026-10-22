import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { missingForSubmit } from "@/lib/talent";
import type { TalentProfileRow } from "@/lib/talent-store";

// Talent home and profile pages with the database and session replaced.

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/auth", () => ({
  requireRole: async () => ({ id: "t1", email: "ana@example.com", role: "talent", fullName: null }),
}));
vi.mock("./profile/actions", () => ({ saveTalentProfile: vi.fn() }));

const data = vi.hoisted(() => ({ profile: null as unknown, rate: null as number | null }));
vi.mock("@/lib/talent-store", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/talent-store")>();
  return {
    ...real,
    loadOwnTalentProfile: async () => data.profile,
    loadOwnMonthlyRate: async () => data.rate,
  };
});

const complete: TalentProfileRow = {
  talent_id: "t1",
  first_name: "Ana",
  last_name: "Reyes",
  phone: "+63 917 555 0100",
  city: "Cebu",
  niche: "executive-assistant",
  headline: "EA for startup founders",
  years_experience: 5,
  skills: ["Calendar", "Travel"],
  tools: ["Notion"],
  summary: "Five years supporting founders across inbox, calendar, travel and investor updates.",
  portfolio_url: null,
  linkedin_url: null,
  intro_video_url: "https://www.loom.com/share/abc",
  schedule: "full_time",
  overlap: "pacific",
  available_from: null,
  resume_path: "t1/resume-1.pdf",
  vetting_status: "draft",
  submitted_at: null,
  privacy_consent_at: null,
};

async function renderHome() {
  const { default: Page } = await import("./page");
  return renderToStaticMarkup(await Page());
}

async function renderProfile() {
  const { default: Page } = await import("./profile/page");
  return renderToStaticMarkup(await Page());
}

describe("talent home", () => {
  it("guides a new applicant to start their profile", async () => {
    data.profile = null;
    data.rate = null;
    const html = await renderHome();
    expect(html).toContain("Welcome to VAriable.");
    expect(html).toContain("Start your profile");
    expect(html).toContain("Your resume");
    expect(html).toContain("Your monthly asking rate");
  });

  it("says everything is in when the draft is complete", async () => {
    data.profile = complete;
    data.rate = 80_000;
    const html = await renderHome();
    expect(html).toContain("Welcome, Ana.");
    expect(html).toContain("Everything is in.");
    expect(html).toContain("Continue your profile");
  });

  it("shows vetting progress after submitting", async () => {
    data.profile = { ...complete, vetting_status: "skills_test" };
    data.rate = 80_000;
    const html = await renderHome();
    expect(html).toContain("Look out for an email with your skills test.");
    expect(html).toContain('aria-current="step"');
    expect(html).not.toContain("Still to add");
  });

  it("does not show a progress bar for a paused profile", async () => {
    data.profile = { ...complete, vetting_status: "paused" };
    const html = await renderHome();
    expect(html).toContain("Paused");
    expect(html).not.toContain('aria-current="step"');
  });
});

describe("talent profile page", () => {
  it("prefills saved answers, including the private rate", async () => {
    data.profile = complete;
    data.rate = 80_000;
    const html = await renderProfile();
    expect(html).toMatch(/name="first_name"[^>]*value="Ana"/);
    expect(html).toMatch(/name="skills"[^>]*value="Calendar, Travel"/);
    expect(html).toMatch(/name="monthly_rate"[^>]*value="800"/);
    expect(html).toContain("resume.pdf");
    expect(html).toContain("Submit for review");
    expect(html).toContain("Philippine Data Privacy Act");
  });

  it("hides submit and consent once submitted with consent", async () => {
    data.profile = { ...complete, vetting_status: "submitted", privacy_consent_at: "2026-10-22T00:00:00Z" };
    const html = await renderProfile();
    expect(html).not.toContain("Submit for review");
    expect(html).not.toContain("Philippine Data Privacy Act");
    expect(html).toContain("Save changes");
  });
});

describe("missingForSubmit", () => {
  it("lists nothing for a complete profile", () => {
    expect(missingForSubmit(complete, true, true)).toEqual([]);
  });

  it("lists every gap for an empty profile", () => {
    expect(missingForSubmit(null, false, false)).toHaveLength(7);
  });
});
