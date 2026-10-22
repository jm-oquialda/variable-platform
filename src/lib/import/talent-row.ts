// Maps one row of the VAriable talent sheet to platform records.
// Relative imports only: the import script runs outside Next.js.
import { isNiche } from "../niches";
import { parseDollarsToCents } from "../pricing/format";
import {
  isVideoLink,
  MAX_MONTHLY_RATE_CENTS,
  MIN_MONTHLY_RATE_CENTS,
  normaliseUrl,
  parseList,
  type TalentProfileInput,
} from "../talent";

export const EXPECTED_COLUMNS = [
  "talent_id", "first_name", "last_name", "email", "phone_whatsapp", "city", "province", "country",
  "date_applied", "source", "applied_role", "niche_category", "tier_fit", "headline", "summary",
  "years_experience", "skills", "tools", "industries", "english_level", "education", "resume_url",
  "portfolio_url", "linkedin_url", "intro_video_url", "photo_url", "availability", "hours_per_day",
  "us_timezone_overlap", "start_date", "asking_rate_usd_month", "vetting_status", "screening_score",
  "skills_test_score", "interview_date", "interview_notes", "why_we_picked", "training_status",
  "placement_status", "current_client", "referred_by", "admin_notes", "last_updated",
] as const;

export type ImportRow = {
  line: number;
  externalRef: string | null;
  email: string;
  name: string;
  sheetRole: string;
  profile: TalentProfileInput;
  monthlyRateCents: number | null;
  status: string;
  appliedAt: string; // ISO, Manila midnight of the application date
  statusAt: string; // ISO, Manila midnight of last_updated (or appliedAt)
  notes: string; // admin-only scorecard notes
  warnings: string[];
  errors: string[];
};

const norm = (s: string) =>
  ` ${s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim()} `;

// Sheet role or category -> niche slug. Checked in order, so more specific
// roles come first (medical VA before VA, GTM engineer before sales ops).
// Lead generation and cold email roles map to GTM Engineer (confirmed by
// Jhona, October 2026).
const NICHE_KEYWORDS: [string, string[]][] = [
  ["medical-billing", ["medical billing", "healthcare admin", "medical va", "medical virtual", "insurance verification", "prior auth"]],
  ["gtm-engineer", ["gtm engineer", "cold email", "lead generation", "lead gen", "clay", "deliverability", "outbound engineer"]],
  ["gtm-manager", ["gtm manager", "gtm lead", "outbound manager", "sdr manager", "growth manager", "sales development"]],
  ["paid-ads", ["paid ads", "media buyer", "ppc", "facebook ads", "google ads", "meta ads"]],
  ["marketing-ops", ["marketing ops", "marketing operations", "marketing automation", "email marketing"]],
  ["social-media-manager", ["social media", "content creator", "community manager"]],
  ["sales-ops", ["sales ops", "sales operations", "crm admin", "revops", "revenue operations", "crm"]],
  ["developer", ["developer", "software engineer", "web dev", "programmer", "full stack", "frontend", "backend"]],
  ["bookkeeper", ["bookkeep", "accounting", "accountant", "quickbooks", "xero"]],
  ["customer-support", ["customer support", "customer service", "support specialist", "help desk", "csr"]],
  ["recruiting-coordinator", ["recruit", "talent acquisition", "sourcer"]],
  ["project-manager", ["project manager", "project coordinator", "program manager", "operations manager"]],
  ["data-analyst", ["data analyst", "research analyst", "market research", "data research"]],
  ["executive-assistant", ["executive assistant", "virtual assistant", "personal assistant", "admin assistant", "administrative", "chief of staff", " ea ", " va "]],
];

export function mapNiche(role: string, category: string): string | null {
  for (const source of [role, category]) {
    const s = norm(source);
    if (s.trim() === "") continue;
    for (const [slug, words] of NICHE_KEYWORDS) {
      // Match from the start of a word: "bookkeep" matches "bookkeeper",
      // but "crm" does not match inside another word.
      if (words.some((w) => s.includes(w.startsWith(" ") ? w : ` ${w}`))) return slug;
    }
  }
  return null;
}

const STATUS_WORDS: [string, string[]][] = [
  ["draft", ["draft", "incomplete"]],
  ["submitted", ["applied", "new", "submitted", "pending", "for review", "received"]],
  ["screening", ["screening", "screened", "for screening", "shortlisted"]],
  ["skills_test", ["skills test", "skill test", "test sent", "tested", "assessment"]],
  ["interview", ["interview", "interviewed", "for interview", "interview scheduled"]],
  ["accepted", ["accepted", "approved", "hired", "placed", "pool", "active", "onboarded"]],
  ["rejected", ["rejected", "declined", "not selected", "failed", "disqualified"]],
  ["paused", ["paused", "on hold", "inactive", "withdrawn"]],
];

// null: the cell is blank. undefined: a value the import does not know.
export function mapStatus(value: string): string | null | undefined {
  if (!value.trim()) return null;
  const s = norm(value).trim();
  for (const [status, words] of STATUS_WORDS) if (words.includes(s)) return status;
  return undefined;
}

// "2026-10-22" or "10/22/2026" -> "2026-10-22"
export function parseSheetDate(value: string): string | null {
  const v = value.trim();
  let y: number, m: number, d: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v);
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (us) [y, m, d] = [Number(us[3]), Number(us[1]), Number(us[2])];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const manilaMidnight = (date: string) => new Date(`${date}T00:00:00+08:00`).toISOString();
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function schedule(value: string): TalentProfileInput["schedule"] {
  const s = norm(value);
  const full = s.includes("full");
  const part = s.includes("part");
  if ((full && part) || s.includes("either") || s.includes("both")) return "either";
  if (full) return "full_time";
  if (part) return "part_time";
  return null;
}

function overlap(value: string): TalentProfileInput["overlap"] {
  const s = norm(value);
  const pacific = /\b(pacific|pt|pst|pdt)\b/.test(s);
  const eastern = /\b(eastern|et|est|edt)\b/.test(s);
  if ((pacific && eastern) || /\b(yes|both|either|any)\b/.test(s)) return "either";
  if (pacific) return "pacific";
  if (eastern) return "eastern";
  return null;
}

export function mapTalentRow(row: Record<string, string>, line: number): ImportRow {
  const g = (k: (typeof EXPECTED_COLUMNS)[number]) => (row[k] ?? "").trim();
  const warnings: string[] = [];
  const errors: string[] = [];
  const notes: string[] = [];

  const email = g("email").toLowerCase();
  if (!EMAIL.test(email)) errors.push("Missing or invalid email");

  const first_name = g("first_name") || null;
  const last_name = g("last_name") || null;
  if (!first_name) warnings.push("No first name");

  const applied = parseSheetDate(g("date_applied"));
  const updated = parseSheetDate(g("last_updated"));
  if (!applied && g("date_applied")) warnings.push(`Unreadable date_applied "${g("date_applied")}"`);
  const appliedDate = applied ?? updated;
  if (!appliedDate) errors.push("No date_applied or last_updated, so the funnel month is unknown");

  const statusInput = g("vetting_status");
  let status = mapStatus(statusInput);
  if (statusInput === "") {
    status = "submitted";
    warnings.push("No vetting status; imported as Submitted");
  } else if (status === undefined) {
    errors.push(`Unknown vetting status "${statusInput}"`);
    status = null;
  }

  const niche = mapNiche(g("applied_role"), g("niche_category"));
  if (!niche) warnings.push(`No role match for "${g("applied_role") || g("niche_category")}"; set it in the profile`);
  else if (!isNiche(niche)) errors.push(`Internal role mapping error: ${niche}`);

  let headline = g("headline") || g("applied_role") || null;
  if (headline && headline.length > 140) {
    warnings.push("Headline cut to 140 characters");
    headline = headline.slice(0, 140);
  }
  let summary = g("summary") || null;
  if (summary && summary.length > 2000) {
    warnings.push("Summary cut to 2,000 characters");
    summary = summary.slice(0, 2000);
  }

  const yearsMatch = /^(\d{1,2})/.exec(g("years_experience"));
  const years_experience = yearsMatch ? Math.min(Number(yearsMatch[1]), 50) : null;
  if (g("years_experience") && !yearsMatch) warnings.push(`Unreadable years_experience "${g("years_experience")}"`);

  const list = (v: string, max: number) => parseList(v.replace(/;/g, ","), max);

  const url = (key: "portfolio_url" | "linkedin_url" | "intro_video_url") => {
    const raw = g(key);
    const value = normaliseUrl(raw);
    if (raw && !value) warnings.push(`Unreadable ${key} "${raw}"`);
    return value;
  };
  let intro_video_url = url("intro_video_url");
  if (intro_video_url && !isVideoLink(intro_video_url)) {
    warnings.push("Intro video is not a Loom or YouTube link; kept in notes only");
    notes.push(`Intro video (not Loom or YouTube): ${intro_video_url}`);
    intro_video_url = null;
  }

  const rateInput = g("asking_rate_usd_month");
  let monthlyRateCents = rateInput ? parseDollarsToCents(rateInput) : null;
  if (rateInput && monthlyRateCents === null) warnings.push(`Unreadable asking rate "${rateInput}"`);
  if (monthlyRateCents !== null && (monthlyRateCents < MIN_MONTHLY_RATE_CENTS || monthlyRateCents > MAX_MONTHLY_RATE_CENTS)) {
    warnings.push(`Asking rate ${rateInput} is outside $200 to $20,000 a month; not imported`);
    monthlyRateCents = null;
  }

  const startDate = parseSheetDate(g("start_date"));
  if (g("start_date") && !startDate) warnings.push(`Unreadable start_date "${g("start_date")}"`);

  if (g("country") && !/philippines/i.test(g("country"))) warnings.push(`Country is ${g("country")}`);

  const sched = schedule(g("availability"));
  if (g("availability") && !sched) warnings.push(`Unreadable availability "${g("availability")}"`);

  // Everything without a profile field goes to the admin-only scorecard notes.
  const extra: [string, string][] = [
    ["Source", g("source")],
    ["Applied role (sheet)", g("applied_role")],
    ["Niche category (sheet)", g("niche_category")],
    ["Tier fit", g("tier_fit")],
    ["English level", g("english_level")],
    ["Education", g("education")],
    ["Industries", g("industries")],
    ["Hours per day", g("hours_per_day")],
    ["Screening score (sheet)", g("screening_score")],
    ["Skills test score (sheet)", g("skills_test_score")],
    ["Interview date", g("interview_date")],
    ["Interview notes", g("interview_notes")],
    ["Why we picked", g("why_we_picked")],
    ["Training status", g("training_status")],
    ["Placement status", g("placement_status")],
    ["Current client", g("current_client")],
    ["Referred by", g("referred_by")],
    ["Admin notes", g("admin_notes")],
    ["Resume (Google Drive, not copied)", g("resume_url")],
    ["Photo", g("photo_url")],
  ];
  const noteText = [
    `Imported from Google Sheets${g("talent_id") ? ` (${g("talent_id")})` : ""}.`,
    ...extra.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`),
    ...notes,
  ].join("\n");

  return {
    line,
    externalRef: g("talent_id") || null,
    email,
    name: [first_name, last_name].filter(Boolean).join(" ") || email,
    sheetRole: g("applied_role") || g("niche_category"),
    profile: {
      first_name,
      last_name,
      phone: g("phone_whatsapp") || null,
      city: [g("city"), g("province")].filter(Boolean).join(", ") || null,
      niche,
      headline,
      years_experience,
      skills: list(g("skills"), 20),
      tools: list(g("tools"), 30),
      summary,
      portfolio_url: url("portfolio_url"),
      linkedin_url: url("linkedin_url"),
      intro_video_url,
      schedule: sched,
      overlap: overlap(g("us_timezone_overlap")),
      available_from: startDate,
    },
    monthlyRateCents,
    status: status ?? "submitted", // rows with an unknown status carry an error and are skipped
    appliedAt: appliedDate ? manilaMidnight(appliedDate) : "",
    statusAt: manilaMidnight((updated && appliedDate && updated >= appliedDate ? updated : appliedDate) ?? "1970-01-01"),
    notes: noteText.slice(0, 4000),
    warnings,
    errors,
  };
}

// Maps every row and flags duplicate emails and sheet IDs within the file.
export function mapTalentSheet(headers: string[], rows: Record<string, string>[]) {
  const missing = EXPECTED_COLUMNS.filter((c) => !headers.includes(c));
  const mapped = rows.map((r, i) => mapTalentRow(r, i + 2));
  const seenEmail = new Map<string, number>();
  const seenRef = new Map<string, number>();
  for (const m of mapped) {
    if (m.email) {
      const first = seenEmail.get(m.email);
      if (first) m.errors.push(`Same email as line ${first}`);
      else seenEmail.set(m.email, m.line);
    }
    if (m.externalRef) {
      const first = seenRef.get(m.externalRef);
      if (first) m.errors.push(`Same talent_id as line ${first}`);
      else seenRef.set(m.externalRef, m.line);
    }
  }
  return { missingColumns: missing, rows: mapped };
}
