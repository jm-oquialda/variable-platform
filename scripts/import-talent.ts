// One-time import of existing talent from the Google Sheet (CSV export).
//
//   npm run import:talent -- path/to/talent.csv                     dry run, writes nothing
//   npm run import:talent -- path/to/talent.csv --commit --consent-from-form
//
// Runs locally with the Supabase service role key from .env.local. For each
// row it creates a talent account (no email is sent), the profile, the
// private asking rate, admin-only notes, and vetting history backdated to
// the application date. People already on the platform are skipped, so the
// script is safe to run again.
import fs from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseCsv } from "../src/lib/import/csv";
import { mapTalentSheet, type ImportRow } from "../src/lib/import/talent-row";

const args = process.argv.slice(2).filter((a) => a !== "--");
const file = args.find((a) => !a.startsWith("--"));
const commit = args.includes("--commit");
const consentFromForm = args.includes("--consent-from-form");

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (!file) fail("Usage: npm run import:talent -- path/to/talent.csv [--commit --consent-from-form]");
if (!fs.existsSync(file)) fail(`File not found: ${file}`);

const { headers, rows } = parseCsv(fs.readFileSync(file, "utf8"));
const { missingColumns, rows: mapped } = mapTalentSheet(headers, rows);

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const ok = mapped.filter((r) => r.errors.length === 0);
const bad = mapped.filter((r) => r.errors.length > 0);
const tally = (key: (r: ImportRow) => string) =>
  Object.entries(ok.reduce<Record<string, number>>((acc, r) => ((acc[key(r)] = (acc[key(r)] ?? 0) + 1), acc), {}))
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `    ${String(n).padStart(4)}  ${k}`)
    .join("\n");

console.log(`\nVAriable talent import: ${file}`);
console.log(`${rows.length} rows read, ${ok.length} ready, ${bad.length} with errors.`);
if (missingColumns.length) console.log(`\nMissing columns (treated as blank): ${missingColumns.join(", ")}`);

for (const r of mapped) {
  if (!r.errors.length && !r.warnings.length) continue;
  console.log(`\nLine ${r.line}  ${r.externalRef ?? ""}  ${r.name} <${r.email}>`);
  for (const e of r.errors) console.log(`  ERROR    ${e}`);
  for (const w of r.warnings) console.log(`  warning  ${w}`);
}

if (ok.length) {
  console.log("\nBy status:\n" + tally((r) => r.status));
  console.log("\nSheet role -> platform role:\n" + tally((r) => `${r.sheetRole || "(blank)"} -> ${r.profile.niche ?? "(none)"}`));
}

if (!commit) {
  console.log("\nDry run: nothing was written. Add --commit --consent-from-form to import.\n");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Commit
// ---------------------------------------------------------------------------
if (!consentFromForm) {
  fail(
    "Refusing to import without --consent-from-form.\n" +
      "Submitted applicants need privacy consent on record (Philippine Data Privacy Act). Add the flag only if\n" +
      "these applicants agreed to VAriable storing their details when they applied (for example a consent\n" +
      "checkbox on the Google Form). Their consent is recorded with the application date and marked\n" +
      "'application_form', not 'platform'.",
  );
}

if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) fail("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.");

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function existingAccounts(db: SupabaseClient, emails: string[]) {
  const found = new Map<string, { id: string; role: string }>();
  for (let i = 0; i < emails.length; i += 100) {
    const { data, error } = await db.from("profiles").select("id, role, email").in("email", emails.slice(i, i + 100));
    if (error) fail(`Could not look up existing accounts: ${error.message}`);
    for (const p of data ?? []) found.set(p.email, { id: p.id, role: p.role });
  }
  return found;
}

async function importRow(r: ImportRow, existing: { id: string; role: string } | undefined) {
  if (existing) {
    return existing.role === "talent"
      ? { result: "skipped", detail: "already on the platform" }
      : { result: "failed", detail: `email belongs to a ${existing.role} account` };
  }

  const { data: created, error: userError } = await supabase.auth.admin.createUser({
    email: r.email,
    email_confirm: true,
    user_metadata: { role: "talent", full_name: r.name },
  });
  if (userError || !created.user) return { result: "failed", detail: `account: ${userError?.message}` };
  const id = created.user.id;

  const step = async (label: string, run: () => PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await run();
    if (error) throw new Error(`${label}: ${error.message}`);
  };

  try {
    await step("profile", () =>
      supabase.from("talent_profiles").insert({
        talent_id: id,
        ...r.profile,
        external_ref: r.externalRef,
        privacy_consent_at: r.appliedAt,
        privacy_consent_source: "application_form",
      }),
    );
    if (r.monthlyRateCents !== null) {
      await step("rate", () => supabase.from("talent_rates").insert({ talent_id: id, monthly_rate_cents: r.monthlyRateCents }));
    }
    await step("notes", () => supabase.from("vetting_scorecards").insert({ talent_id: id, notes: r.notes }));
    if (r.status !== "draft") {
      await step("history", () =>
        supabase.rpc("import_talent_history", {
          p_talent_id: id,
          p_status: r.status,
          p_applied_at: r.appliedAt,
          p_status_at: r.statusAt,
        }),
      );
    }
    return { result: "created", detail: r.status };
  } catch (e) {
    // Undo the half-imported person so a re-run starts clean. Deleting the
    // account cascades to the profile, rate, notes and history.
    await supabase.auth.admin.deleteUser(id);
    return { result: "failed", detail: (e as Error).message };
  }
}

const existing = await existingAccounts(supabase, ok.map((r) => r.email));
const results = { created: 0, skipped: 0, failed: 0 };
console.log("\nImporting...");
for (const r of ok) {
  const { result, detail } = await importRow(r, existing.get(r.email));
  results[result as keyof typeof results] += 1;
  if (result !== "created") console.log(`  ${result.padEnd(8)} line ${r.line}  ${r.email}  (${detail})`);
}
console.log(
  `\nDone: ${results.created} created, ${results.skipped} already on the platform, ${results.failed} failed, ` +
    `${bad.length} not attempted because of errors.\n` +
    "Imported talent sign in with a magic link to their email. Resumes on Google Drive were not copied; the link is in each\n" +
    "applicant's admin notes. Do not also enter these applicants as past counts on the Funnel page, or they will be counted twice.\n",
);
process.exit(results.failed ? 1 : 0);
