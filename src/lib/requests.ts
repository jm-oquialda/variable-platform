import { isNiche } from "./niches";

// "Request talent" form (plan section 7 and flow A). Validation runs on the
// server; the database repeats the key checks as constraints.

export const SCHEDULES = [
  { value: "full_time", label: "Full time", hint: "40 h/week" },
  { value: "part_time", label: "Part time", hint: "20 h/week" },
] as const;

export const TIME_ZONES = [
  { value: "pacific", label: "Pacific (PT)" },
  { value: "mountain", label: "Mountain (MT)" },
  { value: "central", label: "Central (CT)" },
  { value: "eastern", label: "Eastern (ET)" },
  { value: "other", label: "Other" },
] as const;

export const COMMITMENTS = [
  { value: "six_month", label: "6-month commitment", hint: "Lowest monthly price" },
  { value: "month_to_month", label: "Month to month", hint: "After the first 90 days" },
  { value: "undecided", label: "Not sure yet", hint: "Decide after interviews" },
] as const;

export type TalentRequestInput = {
  contact_name: string;
  contact_email: string;
  company: string;
  company_website: string | null;
  niche: string;
  tasks: string;
  tools: string | null;
  schedule: (typeof SCHEDULES)[number]["value"];
  time_zone: (typeof TIME_ZONES)[number]["value"];
  tier_slug: string | null;
  commitment: (typeof COMMITMENTS)[number]["value"];
  ai_agent_build: boolean;
  start_date: string | null;
};

export type FieldErrors = Partial<Record<keyof TalentRequestInput, string>>;

export type ParseResult =
  | { ok: true; data: TalentRequestInput }
  | { ok: false; errors: FieldErrors };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function oneOf<T extends readonly { value: string }[]>(options: T, value: string): T[number]["value"] | null {
  return options.some((o) => o.value === value) ? (value as T[number]["value"]) : null;
}

// `today` is a YYYY-MM-DD string, passed in so tests are deterministic.
export function parseRequestForm(formData: FormData, tierSlugs: string[], today: string): ParseResult {
  const errors: FieldErrors = {};

  const contact_name = text(formData, "contact_name");
  if (!contact_name) errors.contact_name = "Enter your name.";
  else if (contact_name.length > 200) errors.contact_name = "Keep your name under 200 characters.";

  const contact_email = text(formData, "contact_email").toLowerCase();
  if (!EMAIL.test(contact_email) || contact_email.length > 320) errors.contact_email = "Enter a valid work email.";

  const company = text(formData, "company");
  if (!company) errors.company = "Enter your company name.";
  else if (company.length > 200) errors.company = "Keep the company name under 200 characters.";

  const website = text(formData, "company_website");
  if (website.length > 500) errors.company_website = "That website address is too long.";

  const niche = text(formData, "niche");
  if (!isNiche(niche)) errors.niche = "Choose the role you need.";

  const tasks = text(formData, "tasks");
  if (tasks.length < 10) errors.tasks = "Describe the main tasks in a sentence or two.";
  else if (tasks.length > 4000) errors.tasks = "Keep the task description under 4,000 characters.";

  const tools = text(formData, "tools");
  if (tools.length > 1000) errors.tools = "Keep the tools list under 1,000 characters.";

  const schedule = oneOf(SCHEDULES, text(formData, "schedule"));
  if (!schedule) errors.schedule = "Choose full time or part time.";

  const time_zone = oneOf(TIME_ZONES, text(formData, "time_zone"));
  if (!time_zone) errors.time_zone = "Choose your time zone.";

  const tierInput = text(formData, "tier");
  const tier_slug = tierInput === "" || tierInput === "unsure" ? null : tierInput;
  if (tier_slug !== null && !tierSlugs.includes(tier_slug)) errors.tier_slug = "Choose a tier, or Not sure.";

  const commitment = oneOf(COMMITMENTS, text(formData, "commitment"));
  if (!commitment) errors.commitment = "Choose a commitment option.";

  const startInput = text(formData, "start_date");
  const start_date = startInput || null;
  if (start_date && (!DATE.test(start_date) || Number.isNaN(Date.parse(start_date)))) {
    errors.start_date = "Enter a valid date.";
  } else if (start_date && start_date < today) {
    errors.start_date = "Pick a start date from today onwards.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      contact_name,
      contact_email,
      company,
      company_website: website || null,
      niche,
      tasks,
      tools: tools || null,
      schedule: schedule!,
      time_zone: time_zone!,
      tier_slug,
      commitment: commitment!,
      ai_agent_build: formData.get("ai_agent_build") === "on",
      start_date,
    },
  };
}

// Hidden field that people never see or fill. Bots that fill every field
// get a normal-looking success page and nothing is stored.
export const HONEYPOT_FIELD = "fax_number";

export function isLikelyBot(formData: FormData) {
  return text(formData, HONEYPOT_FIELD) !== "";
}

export type QuestionInput = { name: string; email: string; message: string };

export function parseQuestionForm(formData: FormData):
  | { ok: true; data: QuestionInput }
  | { ok: false; errors: Partial<Record<keyof QuestionInput, string>> } {
  const errors: Partial<Record<keyof QuestionInput, string>> = {};
  const name = text(formData, "name");
  const email = text(formData, "email").toLowerCase();
  const message = text(formData, "message");
  if (!name || name.length > 200) errors.name = "Enter your name.";
  if (!EMAIL.test(email) || email.length > 320) errors.email = "Enter a valid email.";
  if (message.length < 5) errors.message = "Write your question.";
  else if (message.length > 4000) errors.message = "Keep your question under 4,000 characters.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data: { name, email, message } };
}
