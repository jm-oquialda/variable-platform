import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";
import { EXPECTED_COLUMNS, mapNiche, mapStatus, mapTalentRow, mapTalentSheet, parseSheetDate } from "./talent-row";

// The header and sample row Jhona shared (va-talent-columns.csv).
const SAMPLE = `talent_id,first_name,last_name,email,phone_whatsapp,city,province,country,date_applied,source,applied_role,niche_category,tier_fit,headline,summary,years_experience,skills,tools,industries,english_level,education,resume_url,portfolio_url,linkedin_url,intro_video_url,photo_url,availability,hours_per_day,us_timezone_overlap,start_date,asking_rate_usd_month,vetting_status,screening_score,skills_test_score,interview_date,interview_notes,why_we_picked,training_status,placement_status,current_client,referred_by,admin_notes,last_updated\r
VAR-0001,Maria,Santos,maria.sample@example.com,+63 900 000 0000,Davao City,Davao del Sur,Philippines,2026-10-22,OnlineJobs.ph,Lead Generation & Cold Email Specialist,GTM / Sales Ops,Executive,Lead Generation and Cold Email Specialist,4+ years of B2B outbound for US SaaS and healthcare companies,4,Lead generation; Cold email; List building; CRM management,HubSpot; Apollo; Clay; Instantly; Smartlead; Zapier,SaaS; Healthcare,C2,Master's degree,https://drive.google.com/sample-resume,https://sample-portfolio.com,https://linkedin.com/in/sample,https://loom.com/share/sample,,Full time,8,Yes,2026-11-01,900,Interviewed,7,8,2026-10-24,Strong on Clay and Apollo; no DNS setup yet,"Built Clay enrichment for 10,000+ contacts",Not started,Available,,,"Sample row, not a real person",2026-10-23\r
\r
`;

describe("parseCsv", () => {
  it("reads the sample export: CRLF, quoted commas, blank trailing line", () => {
    const { headers, rows } = parseCsv(SAMPLE);
    expect(headers).toEqual([...EXPECTED_COLUMNS]);
    expect(rows).toHaveLength(1);
    expect(rows[0].why_we_picked).toBe("Built Clay enrichment for 10,000+ contacts");
    expect(rows[0].admin_notes).toBe("Sample row, not a real person");
    expect(rows[0].photo_url).toBe("");
  });

  it("handles doubled quotes, new lines in quotes and a byte order mark", () => {
    const { headers, rows } = parseCsv('﻿a,b\n"say ""hi""","line 1\nline 2"\n');
    expect(headers).toEqual(["a", "b"]);
    expect(rows[0]).toEqual({ a: 'say "hi"', b: "line 1\nline 2" });
  });

  it("rejects an unclosed quote", () => {
    expect(() => parseCsv('a\n"oops')).toThrow(/unclosed quote/);
  });
});

describe("mapTalentRow: the sample row", () => {
  const row = mapTalentRow(parseCsv(SAMPLE).rows[0], 2);

  it("has no errors", () => {
    expect(row.errors).toEqual([]);
  });

  it("maps the profile fields", () => {
    expect(row.externalRef).toBe("VAR-0001");
    expect(row.email).toBe("maria.sample@example.com");
    expect(row.profile).toEqual({
      first_name: "Maria",
      last_name: "Santos",
      phone: "+63 900 000 0000",
      city: "Davao City, Davao del Sur",
      niche: "gtm-engineer",
      headline: "Lead Generation and Cold Email Specialist",
      years_experience: 4,
      skills: ["Lead generation", "Cold email", "List building", "CRM management"],
      tools: ["HubSpot", "Apollo", "Clay", "Instantly", "Smartlead", "Zapier"],
      summary: "4+ years of B2B outbound for US SaaS and healthcare companies",
      portfolio_url: "https://sample-portfolio.com/",
      linkedin_url: "https://linkedin.com/in/sample",
      intro_video_url: "https://loom.com/share/sample",
      schedule: "full_time",
      overlap: "either",
      available_from: "2026-11-01",
    });
  });

  it("maps rate, status and dates", () => {
    expect(row.monthlyRateCents).toBe(90_000);
    expect(row.status).toBe("interview");
    expect(row.appliedAt).toBe("2026-10-21T16:00:00.000Z"); // midnight in Manila
    expect(row.statusAt).toBe("2026-10-22T16:00:00.000Z");
  });

  it("keeps everything else in admin-only notes", () => {
    expect(row.notes).toContain("Imported from Google Sheets (VAR-0001).");
    expect(row.notes).toContain("Source: OnlineJobs.ph");
    expect(row.notes).toContain("Tier fit: Executive");
    expect(row.notes).toContain("English level: C2");
    expect(row.notes).toContain("Screening score (sheet): 7");
    expect(row.notes).toContain("Interview notes: Strong on Clay and Apollo; no DNS setup yet");
    expect(row.notes).toContain("Why we picked: Built Clay enrichment for 10,000+ contacts");
    expect(row.notes).toContain("Resume (Google Drive, not copied): https://drive.google.com/sample-resume");
    expect(row.notes).not.toContain("Photo:");
  });
});

describe("mapTalentRow: problems", () => {
  const base = parseCsv(SAMPLE).rows[0];
  const map = (o: Record<string, string>) => mapTalentRow({ ...base, ...o }, 5);

  it("skips a row without a valid email", () => {
    expect(map({ email: "nope" }).errors).toContain("Missing or invalid email");
  });

  it("skips a row with an unknown status", () => {
    expect(map({ vetting_status: "Maybe later" }).errors[0]).toMatch(/Unknown vetting status/);
  });

  it("imports a blank status as Submitted, with a warning", () => {
    const r = map({ vetting_status: "" });
    expect(r.status).toBe("submitted");
    expect(r.warnings).toContain("No vetting status; imported as Submitted");
  });

  it("falls back to last_updated when date_applied is blank, and errors with neither", () => {
    expect(map({ date_applied: "" }).appliedAt).toBe("2026-10-22T16:00:00.000Z");
    expect(map({ date_applied: "", last_updated: "" }).errors[0]).toMatch(/funnel month/);
  });

  it("reads US-style dates", () => {
    expect(map({ date_applied: "3/9/2026" }).appliedAt).toBe("2026-03-08T16:00:00.000Z");
  });

  it("drops an out-of-range rate with a warning", () => {
    const r = map({ asking_rate_usd_month: "9" });
    expect(r.monthlyRateCents).toBeNull();
    expect(r.warnings.join()).toMatch(/outside/);
  });

  it("keeps a non-Loom video link in notes only", () => {
    const r = map({ intro_video_url: "https://vimeo.com/1" });
    expect(r.profile.intro_video_url).toBeNull();
    expect(r.notes).toContain("https://vimeo.com/1");
  });

  it("warns when no role matches", () => {
    const r = map({ applied_role: "Astronaut", niche_category: "" });
    expect(r.profile.niche).toBeNull();
    expect(r.warnings.join()).toMatch(/No role match/);
  });
});

describe("mapTalentSheet", () => {
  it("flags duplicate emails and sheet IDs, and missing columns", () => {
    const { rows } = parseCsv(SAMPLE);
    const result = mapTalentSheet(["email"], [rows[0], { ...rows[0], talent_id: "VAR-0002" }, { ...rows[0], email: "x@y.co" }]);
    expect(result.missingColumns).toContain("talent_id");
    expect(result.rows[1].errors).toContain("Same email as line 2");
    expect(result.rows[2].errors).toContain("Same talent_id as line 2");
  });
});

describe("lookups", () => {
  it.each([
    ["Executive Assistant", "", "executive-assistant"],
    ["Medical Virtual Assistant", "", "medical-billing"],
    ["Virtual Assistant", "", "executive-assistant"],
    ["Social Media Manager", "", "social-media-manager"],
    ["Full Stack Developer", "", "developer"],
    ["Bookkeeper", "", "bookkeeper"],
    ["Something new", "GTM / Sales Ops", "sales-ops"],
    ["Customer Service Rep", "", "customer-support"],
  ])("role %s / %s -> %s", (role, category, slug) => {
    expect(mapNiche(role, category)).toBe(slug);
  });

  it("matches keywords from the start of a word only", () => {
    expect(mapNiche("Scrm specialist", "")).toBeNull();
  });

  it.each([
    ["Interviewed", "interview"],
    ["For Interview", "interview"],
    ["Hired", "accepted"],
    ["On hold", "paused"],
    ["Not selected", "rejected"],
    ["", null],
    ["???", undefined],
  ])("status %s", (input, status) => {
    expect(mapStatus(input)).toBe(status);
  });

  it("validates sheet dates", () => {
    expect(parseSheetDate("2026-02-30")).toBeNull();
    expect(parseSheetDate("12/31/2026")).toBe("2026-12-31");
  });
});
