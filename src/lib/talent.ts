import { isNiche } from "./niches";
import { parseDollarsToCents } from "./pricing/format";

// Talent profile form (plan section 7: niche, skills, experience,
// portfolio, resume, intro video link, availability, private asking rate).
// "draft" only checks what was typed; "submit" also requires the fields
// VAriable needs for vetting.

export const TALENT_SCHEDULES = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
  { value: "either", label: "Either" },
] as const;

export const OVERLAPS = [
  { value: "pacific", label: "US Pacific hours" },
  { value: "eastern", label: "US Eastern hours" },
  { value: "either", label: "Either" },
] as const;

export const VETTING_STATUS: Record<string, { label: string; text: string }> = {
  draft: { label: "Draft", text: "Finish your profile and submit it for review." },
  submitted: { label: "Submitted", text: "VAriable has your profile and will be in touch about next steps." },
  screening: { label: "Screening", text: "VAriable is reviewing your profile." },
  skills_test: { label: "Skills test", text: "Look out for an email with your skills test." },
  interview: { label: "Interview", text: "VAriable will schedule an interview with you." },
  accepted: { label: "Accepted", text: "Welcome to VAriable. Your profile is in the matching pool." },
  rejected: { label: "Not selected", text: "VAriable is not moving forward right now. Thank you for applying." },
  paused: { label: "Paused", text: "Your profile is paused. Contact VAriable to reactivate it." },
};

// Asking rate bounds in cents per month: catches typos such as an hourly
// rate entered as monthly, or an extra zero.
export const MIN_MONTHLY_RATE_CENTS = 20_000; // $200
export const MAX_MONTHLY_RATE_CENTS = 2_000_000; // $20,000

export type TalentProfileInput = {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  city: string | null;
  niche: string | null;
  headline: string | null;
  years_experience: number | null;
  skills: string[];
  tools: string[];
  summary: string | null;
  portfolio_url: string | null;
  linkedin_url: string | null;
  intro_video_url: string | null;
  schedule: (typeof TALENT_SCHEDULES)[number]["value"] | null;
  overlap: (typeof OVERLAPS)[number]["value"] | null;
  available_from: string | null;
};

export type TalentFormData = {
  profile: TalentProfileInput;
  monthlyRateCents: number | null;
  privacyConsent: boolean;
};

export type TalentFieldErrors = Partial<Record<keyof TalentProfileInput | "monthly_rate" | "privacy_consent" | "resume", string>>;

function text(formData: FormData, name: string, max: number, errors: TalentFieldErrors, label: string) {
  const value = String(formData.get(name) ?? "").trim();
  if (value.length > max) errors[name as keyof TalentFieldErrors] = `Keep ${label} under ${max} characters.`;
  return value || null;
}

// "Clay, HubSpot,  clay" -> ["Clay", "HubSpot"]
export function parseList(input: string, max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/[,\n]/)) {
    const item = raw.trim().slice(0, 60);
    if (item && !seen.has(item.toLowerCase())) {
      seen.add(item.toLowerCase());
      out.push(item);
    }
  }
  return out.slice(0, max);
}

// Adds https:// when missing; returns null for anything that is not a web URL.
export function normaliseUrl(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

// Intro videos are Loom or YouTube links in the MVP.
export function isVideoLink(url: string): boolean {
  const host = new URL(url).hostname.replace(/^www\./, "");
  return ["loom.com", "youtube.com", "youtu.be", "m.youtube.com"].includes(host);
}

export function parseTalentProfileForm(
  formData: FormData,
  mode: "draft" | "submit",
  today: string,
): { ok: true; data: TalentFormData } | { ok: false; errors: TalentFieldErrors } {
  const errors: TalentFieldErrors = {};

  const first_name = text(formData, "first_name", 100, errors, "your first name");
  const last_name = text(formData, "last_name", 100, errors, "your last name");
  const phone = text(formData, "phone", 40, errors, "the phone number");
  const city = text(formData, "city", 100, errors, "the city");
  const headline = text(formData, "headline", 140, errors, "the headline");
  const summary = text(formData, "summary", 2000, errors, "the summary");

  const nicheInput = String(formData.get("niche") ?? "").trim();
  const niche = nicheInput || null;
  if (niche && !isNiche(niche)) errors.niche = "Choose a role from the list.";

  const yearsInput = String(formData.get("years_experience") ?? "").trim();
  let years_experience: number | null = null;
  if (yearsInput) {
    years_experience = Number(yearsInput);
    if (!Number.isInteger(years_experience) || years_experience < 0 || years_experience > 50) {
      errors.years_experience = "Enter whole years, 0 to 50.";
      years_experience = null;
    }
  }

  const skills = parseList(String(formData.get("skills") ?? ""), 20);
  const tools = parseList(String(formData.get("tools") ?? ""), 30);

  const urls = {} as Record<"portfolio_url" | "linkedin_url" | "intro_video_url", string | null>;
  for (const name of ["portfolio_url", "linkedin_url", "intro_video_url"] as const) {
    const raw = String(formData.get(name) ?? "").trim();
    urls[name] = normaliseUrl(raw);
    if (raw && !urls[name]) errors[name] = "Enter a full web address.";
    else if (urls[name] && urls[name]!.length > 500) errors[name] = "That address is too long.";
  }
  if (urls.intro_video_url && !errors.intro_video_url && !isVideoLink(urls.intro_video_url)) {
    errors.intro_video_url = "Use a Loom or YouTube link.";
  }

  const scheduleInput = String(formData.get("schedule") ?? "");
  const schedule = TALENT_SCHEDULES.find((s) => s.value === scheduleInput)?.value ?? null;
  const overlapInput = String(formData.get("overlap") ?? "");
  const overlap = OVERLAPS.find((o) => o.value === overlapInput)?.value ?? null;

  const available_from = String(formData.get("available_from") ?? "").trim() || null;
  if (available_from && (!/^\d{4}-\d{2}-\d{2}$/.test(available_from) || Number.isNaN(Date.parse(available_from)))) {
    errors.available_from = "Enter a valid date.";
  }

  const rateInput = String(formData.get("monthly_rate") ?? "").trim();
  let monthlyRateCents: number | null = null;
  if (rateInput) {
    monthlyRateCents = parseDollarsToCents(rateInput);
    if (monthlyRateCents === null) errors.monthly_rate = "Enter your monthly rate in US dollars, for example 800.";
    else if (monthlyRateCents < MIN_MONTHLY_RATE_CENTS || monthlyRateCents > MAX_MONTHLY_RATE_CENTS) {
      errors.monthly_rate = "Enter a monthly rate between $200 and $20,000.";
    }
  }

  const privacyConsent = formData.get("privacy_consent") === "on";

  if (mode === "submit") {
    const need = (ok: unknown, key: keyof TalentFieldErrors, message: string) => {
      if (!ok && !errors[key]) errors[key] = message;
    };
    need(first_name, "first_name", "Enter your first name.");
    need(last_name, "last_name", "Enter your last name.");
    need(phone, "phone", "Enter a phone number VAriable can reach you on.");
    need(niche, "niche", "Choose your main role.");
    need(headline, "headline", "Add a one-line headline.");
    need(years_experience !== null, "years_experience", "Enter your years of experience.");
    need(skills.length > 0, "skills", "Add at least one skill.");
    need(summary && summary.length >= 50, "summary", "Write at least a few sentences about your experience.");
    need(urls.intro_video_url, "intro_video_url", "Add a Loom or YouTube intro video link.");
    need(schedule, "schedule", "Choose your availability.");
    need(overlap, "overlap", "Choose which US hours you can work.");
    need(monthlyRateCents !== null, "monthly_rate", "Enter your monthly asking rate.");
    need(privacyConsent, "privacy_consent", "Agree to the privacy terms to submit.");
    if (available_from && available_from < today && !errors.available_from) {
      errors.available_from = "Pick a date from today onwards, or leave it blank.";
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      profile: {
        first_name,
        last_name,
        phone,
        city,
        niche,
        headline,
        years_experience,
        skills,
        tools,
        summary,
        portfolio_url: urls.portfolio_url,
        linkedin_url: urls.linkedin_url,
        intro_video_url: urls.intro_video_url,
        schedule,
        overlap,
        available_from,
      },
      monthlyRateCents,
      privacyConsent,
    },
  };
}

// What is still missing before a saved profile can be submitted. Used for
// the checklist on the talent home page.
export function missingForSubmit(
  p: Partial<TalentProfileInput> | null,
  hasRate: boolean,
  hasResume: boolean,
): string[] {
  const missing: string[] = [];
  if (!p?.first_name || !p?.last_name || !p?.phone) missing.push("Your name and phone number");
  if (!p?.niche || !p?.headline || p?.years_experience == null) missing.push("Your role, headline and experience");
  if (!p?.skills?.length || !p?.summary || p.summary.length < 50) missing.push("Skills and a short summary");
  if (!p?.intro_video_url) missing.push("An intro video link");
  if (!p?.schedule || !p?.overlap) missing.push("Your availability");
  if (!hasRate) missing.push("Your monthly asking rate");
  if (!hasResume) missing.push("Your resume");
  return missing;
}

// Resume upload rules, matching the 'resumes' bucket settings.
export const RESUME_MAX_BYTES = 5 * 1024 * 1024;
export const RESUME_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

export function checkResume(file: { size: number; type: string }): string | null {
  if (!RESUME_TYPES[file.type]) return "Upload a PDF or Word (.docx) file.";
  if (file.size > RESUME_MAX_BYTES) return "Keep the file under 5 MB.";
  return null;
}
