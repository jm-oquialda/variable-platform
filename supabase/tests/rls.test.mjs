// Runs the migration against an in-memory Postgres with a minimal Supabase
// stand-in (anon/authenticated roles, auth.users, auth.uid()) and checks the
// row-level security rules.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

// Apply every migration in order, like Supabase does.
const dir = process.argv[2] ?? "supabase/migrations";
const migration = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
  .map((f) => fs.readFileSync(`${dir}/${f}`, "utf8")).join("\n");
const db = new PGlite();

await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  -- Minimal Supabase Storage tables and helper.
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id),
    name text not null, owner uuid);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema storage to anon, authenticated;
  grant all on storage.objects to anon, authenticated;
  grant execute on function storage.foldername(text) to anon, authenticated;
  create schema auth;
  create table auth.users (id uuid primary key, raw_user_meta_data jsonb not null default '{}');
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  -- Supabase grants table access to these roles by default; RLS does the rest.
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
`);
await db.exec(migration);

const id = (n) => `00000000-0000-0000-0000-00000000000${n}`;
const U = { admin: id(1), t1: id(2), t2: id(3), client: id(4), partner: id(5), sneaky: id(6) };
await db.exec(`
  insert into auth.users values
    ('${U.admin}', '{"role":"client","full_name":"Jhona O."}'),
    ('${U.t1}', '{"role":"talent","full_name":"Ana R."}'),
    ('${U.t2}', '{"role":"talent"}'),
    ('${U.client}', '{"role":"client"}'),
    ('${U.partner}', '{"role":"partner"}'),
    ('${U.sneaky}', '{"role":"admin"}');
  -- First admin and partner set from the SQL editor (no signed-in user).
  update public.profiles set role = 'admin' where id = '${U.admin}';
  update public.profiles set role = 'partner' where id = '${U.partner}';
`);

async function as(who, sql) {
  await db.exec(`set role ${who === "anon" ? "anon" : "authenticated"}`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [who === "anon" ? "" : U[who]]);
  try {
    return { rows: (await db.query(sql)).rows };
  } catch (e) {
    return { error: e.message };
  } finally {
    await db.exec(`reset role`);
  }
}

let failed = 0;
function check(name, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + JSON.stringify(detail)}`);
  if (!ok) failed++;
}

let r;
r = await db.query(`select id, role from public.profiles order by id`);
const roles = Object.fromEntries(r.rows.map((x) => [x.id, x.role]));
check("sign-up asking for 'admin' becomes client", roles[U.sneaky] === "client", roles[U.sneaky]);
check("role set from the SQL editor (first admin, partners) is allowed", roles[U.partner] === "partner" && roles[U.admin] === "admin", roles);
check("talent sign-up gets talent role", roles[U.t1] === "talent", roles[U.t1]);

r = await as("t1", `insert into public.talent_rates (talent_id, monthly_rate_cents) values ('${U.t1}', 80000) returning talent_id`);
check("talent sets own rate", !r.error, r);
r = await as("t1", `insert into public.talent_rates (talent_id, monthly_rate_cents) values ('${U.t2}', 1) returning talent_id`);
check("talent cannot set another talent's rate", !!r.error, r);
r = await as("client", `insert into public.talent_rates (talent_id, monthly_rate_cents) values ('${U.client}', 1) returning talent_id`);
check("client cannot create a rate row", !!r.error, r);
r = await as("admin", `insert into public.talent_rates (talent_id, monthly_rate_cents) values ('${U.t2}', 100000) returning talent_id`);
check("admin sets any rate", !r.error, r);

r = await as("t1", `select talent_id from public.talent_rates`);
check("talent sees only own rate", r.rows?.length === 1 && r.rows[0].talent_id === U.t1, r);
r = await as("client", `select * from public.talent_rates`);
check("client sees no rates", r.rows?.length === 0, r);
r = await as("partner", `select * from public.talent_rates`);
check("partner sees no rates", r.rows?.length === 0, r);
r = await as("anon", `select * from public.talent_rates`);
check("anonymous visitor cannot query rates", !!r.error, r);
r = await as("admin", `select * from public.talent_rates`);
check("admin sees all rates", r.rows?.length === 2, r);
r = await as("t1", `update public.talent_rates set monthly_rate_cents = 85000 where talent_id = '${U.t2}' returning talent_id`);
check("talent cannot change another talent's rate", r.rows?.length === 0 || !!r.error, r);

r = await as("t1", `update public.profiles set role = 'admin' where id = '${U.t1}'`);
check("talent cannot make themselves admin", !!r.error, r);
r = await as("client", `update public.profiles set role = 'talent' where id = '${U.client}'`);
check("client cannot switch own role", !!r.error, r);
r = await as("client", `update public.profiles set full_name = 'Pat K.' where id = '${U.client}' returning full_name`);
check("client can edit own name", r.rows?.[0]?.full_name === "Pat K.", r);
r = await as("client", `select id from public.profiles`);
check("client sees only own profile", r.rows?.length === 1, r);
r = await as("client", `update public.profiles set full_name = 'x' where id = '${U.t1}' returning id`);
check("client cannot edit someone else's profile", r.rows?.length === 0 || !!r.error, r);
r = await as("admin", `update public.profiles set role = 'partner' where id = '${U.sneaky}' returning role`);
check("admin can change a role", r.rows?.[0]?.role === "partner", r);
r = await as("admin", `select id from public.profiles`);
check("admin sees all profiles", r.rows?.length === 6, r);

r = await as("t1", `select * from public.audit_log`);
check("talent cannot read audit log", r.rows?.length === 0, r);
r = await as("admin", `insert into public.audit_log (table_name, row_id, action) values ('x','1','insert')`);
check("nobody writes audit log directly", !!r.error, r);
r = await as("admin", `select table_name, action, actor_id from public.audit_log order by id`);
const log = r.rows ?? [];
check("rate changes are audited with the actor",
  log.some((x) => x.table_name === "talent_rates" && x.actor_id === U.t1) &&
  log.some((x) => x.table_name === "talent_rates" && x.actor_id === U.admin), log);
check("role changes are audited",
  log.some((x) => x.table_name === "profiles" && x.actor_id === U.admin), log);

// Pricing settings (migration 20261021010000)
r = await as("anon", `select slug, name from public.tiers order by sort_order`);
check("visitors can read tier names and published prices", r.rows?.length === 3, r);
r = await as("anon", `select slug from public.addon_packages`);
check("visitors can read add-on packages", r.rows?.length === 3, r);
r = await as("anon", `select * from public.tier_min_rates`);
check("visitors cannot query tier minimum rates", !!r.error, r);
r = await as("anon", `select * from public.pricing_rules`);
check("visitors cannot query pricing rules", !!r.error, r);
for (const who of ["client", "t1", "partner"]) {
  r = await as(who, `select * from public.tier_min_rates`);
  check(`${who} sees no tier minimum rates`, r.rows?.length === 0, r);
  r = await as(who, `select * from public.pricing_rules`);
  check(`${who} sees no pricing rules`, r.rows?.length === 0, r);
}
r = await as("client", `update public.tiers set commitment_price_cents = 100 returning slug`);
check("client cannot change published prices", r.rows?.length === 0 || !!r.error, r);
r = await as("anon", `update public.addon_packages set setup_cents = 100 returning slug`);
check("visitor cannot change add-on prices", r.rows?.length === 0 || !!r.error, r);
r = await as("admin", `select min_monthly_rate_cents from public.tier_min_rates order by tier_slug`);
check("admin reads tier minimum rates", r.rows?.length === 3, r);
r = await as("admin", `update public.tiers set commitment_price_cents = 145500, standard_price_cents = 175000, prices_published_at = now() where slug = 'essentials' returning slug`);
check("admin publishes tier prices", r.rows?.length === 1, r);
r = await as("admin", `insert into public.pricing_rules (scope, scope_id, target_margin_bps) values ('role', 'developer', 4000) returning id`);
check("admin adds a role override", r.rows?.length === 1, r);
r = await as("admin", `insert into public.pricing_rules (scope, scope_id, target_margin_bps) values ('role', 'developer', 3900) returning id`);
check("only one override per role", !!r.error, r);
r = await as("admin", `insert into public.pricing_rules (scope, target_margin_bps) values ('role', 4000) returning id`);
check("an override needs a target", !!r.error, r);
r = await as("admin", `insert into public.pricing_rules (scope, target_margin_bps, standard_uplift_bps, rounding_step_cents) values ('global', 4000, 12000, 500) returning id`);
check("only one global rule", !!r.error, r);
r = await as("admin", `update public.pricing_rules set target_margin_bps = 10000 where scope = 'global' returning id`);
check("margin of 100% or more is rejected", !!r.error, r);
r = await as("admin", `delete from public.pricing_rules where scope = 'global'`);
check("global rule cannot be deleted", !!r.error, r);
r = await as("admin", `select table_name from public.audit_log where table_name in ('pricing_rules', 'tiers')`);
check("pricing changes are audited", r.rows?.some((x) => x.table_name === "pricing_rules") && r.rows?.some((x) => x.table_name === "tiers"), r);

// Requests and questions (migration 20261022000000)
const req = (cols = "", vals = "") => `insert into public.talent_requests
  (contact_name, contact_email, company, niche, tasks, schedule, time_zone, commitment${cols})
  values ('Pat', 'pat@acme.com', 'Acme', 'executive-assistant', 'Inbox and calendar', 'full_time', 'pacific', 'six_month'${vals})`;
r = await as("anon", req());
check("visitor can submit a talent request", !r.error, r);
r = await as("anon", req(", status", ", 'placed'"));
check("visitor cannot set request status", !!r.error, r);
r = await as("anon", req(", client_id", `, '${U.client}'`));
check("visitor cannot attach a request to a client", !!r.error, r);
r = await as("client", req(", client_id", `, '${U.client}'`));
check("client submits a request as themselves", !r.error, r);
r = await as("client", req(", client_id", `, '${U.t1}'`));
check("client cannot submit as someone else", !!r.error, r);
r = await as("client", req(", status, admin_notes, source", ", 'placed', 'x', 'partner'"));
check("client's admin fields are reset", !r.error, r);
r = await db.query(`select count(*)::int as n from public.talent_requests where status <> 'new' or admin_notes is not null or source <> 'website'`);
check("no submitter-set status, notes or source got through", r.rows[0].n === 0, r.rows);
r = await as("anon", `select * from public.talent_requests`);
check("visitor cannot read requests", (r.rows?.length ?? 0) === 0, r);
r = await as("client", `select client_id from public.talent_requests`);
check("client reads only own requests", r.rows?.length === 1 && r.rows.every((x) => x.client_id === U.client), r);
r = await as("t1", `select * from public.talent_requests`);
check("talent cannot read requests", r.rows?.length === 0, r);
r = await as("client", `update public.talent_requests set status = 'placed' returning id`);
check("client cannot update requests", (r.rows?.length ?? 0) === 0 || !!r.error, r);
r = await as("admin", `select id from public.talent_requests`);
check("admin reads all requests", r.rows?.length === 3, r);
r = await as("admin", req(", source, partner_name, status", ", 'partner', 'Flextroops', 'matching'"));
check("admin enters a partner request", !r.error, r);
r = await db.query(`select count(*)::int as n from public.talent_requests where source = 'partner' and partner_name = 'Flextroops' and status = 'matching'`);
check("admin fields kept for admin", r.rows[0].n === 1, r.rows);
r = await as("admin", `update public.talent_requests set status = 'matching' where client_id = '${U.client}' returning id`);
check("admin updates request status", r.rows?.length === 1, r);
r = await as("anon", req("", "").replace("pat@acme.com", "not-an-email"));
check("invalid email rejected by the database", !!r.error, r);

r = await as("anon", `insert into public.questions (name, email, message) values ('Sam', 'sam@x.co', 'Do you cover Eastern time?')`);
check("visitor can ask a question", !r.error, r);
r = await as("anon", `insert into public.questions (name, email, message, handled) values ('Sam', 'sam@x.co', 'x', true)`);
check("visitor cannot mark a question handled", !!r.error, r);
r = await as("client", `select * from public.questions`);
check("client cannot read questions", r.rows?.length === 0, r);
r = await as("admin", `update public.questions set handled = true returning id`);
check("admin reads and handles questions", r.rows?.length === 1, r);

// Talent profiles and resumes (migration 20261022010000)
r = await as("t1", `insert into public.talent_profiles (talent_id, first_name, niche) values ('${U.t1}', 'Ana', 'executive-assistant') returning vetting_status`);
check("talent creates own draft profile", r.rows?.[0]?.vetting_status === "draft", r);
r = await as("t1", `insert into public.talent_profiles (talent_id) values ('${U.t2}')`);
check("talent cannot create another talent's profile", !!r.error, r);
r = await as("client", `insert into public.talent_profiles (talent_id) values ('${U.client}')`);
check("client cannot create a talent profile", !!r.error, r);
r = await as("t1", `update public.talent_profiles set vetting_status = 'submitted' where talent_id = '${U.t1}'`);
check("cannot submit without privacy consent", !!r.error, r);
r = await as("t1", `update public.talent_profiles set vetting_status = 'submitted', privacy_consent_at = now() where talent_id = '${U.t1}' returning submitted_at`);
check("talent submits with consent and submitted_at is set", !!r.rows?.[0]?.submitted_at, r);
r = await as("t1", `update public.talent_profiles set vetting_status = 'accepted' where talent_id = '${U.t1}'`);
check("talent cannot accept themselves", !!r.error, r);
r = await as("t1", `update public.talent_profiles set submitted_at = '2020-01-01' where talent_id = '${U.t1}' returning submitted_at`);
check("talent cannot backdate submitted_at", r.rows?.[0] && !String(r.rows[0].submitted_at).startsWith("2020"), r);
r = await as("t1", `update public.talent_profiles set headline = 'EA for founders' where talent_id = '${U.t1}' returning headline`);
check("talent can keep editing after submitting", r.rows?.[0]?.headline === "EA for founders", r);
r = await as("t2", `insert into public.talent_profiles (talent_id, vetting_status, privacy_consent_at) values ('${U.t2}', 'accepted', now())`);
check("talent cannot create a profile already accepted", !!r.error, r);
r = await as("t2", `insert into public.talent_profiles (talent_id, resume_path) values ('${U.t2}', '${U.t1}/cv.pdf')`);
check("resume path must be in the talent's own folder", !!r.error, r);
for (const who of ["client", "partner", "t2"]) {
  r = await as(who, `select * from public.talent_profiles where talent_id = '${U.t1}'`);
  check(`${who} cannot read another talent's profile`, r.rows?.length === 0, r);
}
r = await as("anon", `select * from public.talent_profiles`);
check("visitors cannot query talent profiles", !!r.error, r);
r = await as("admin", `update public.talent_profiles set vetting_status = 'screening' where talent_id = '${U.t1}' returning vetting_status`);
check("admin moves a profile through vetting", r.rows?.[0]?.vetting_status === "screening", r);
r = await as("admin", `select count(*)::int as n from public.audit_log where table_name = 'talent_profiles'`);
check("vetting status changes are audited", r.rows?.[0]?.n >= 2, r);

r = await as("t1", `insert into storage.objects (bucket_id, name) values ('resumes', '${U.t1}/cv.pdf')`);
check("talent uploads a resume to own folder", !r.error, r);
r = await as("t1", `insert into storage.objects (bucket_id, name) values ('resumes', '${U.t2}/cv.pdf')`);
check("talent cannot upload into another folder", !!r.error, r);
r = await as("client", `insert into storage.objects (bucket_id, name) values ('resumes', '${U.client}/cv.pdf')`);
check("client cannot upload resumes", !!r.error, r);
r = await as("client", `select name from storage.objects where bucket_id = 'resumes'`);
check("client cannot see any resume", r.rows?.length === 0, r);
r = await as("t2", `select name from storage.objects where bucket_id = 'resumes'`);
check("talent cannot see another talent's resume", r.rows?.length === 0, r);
r = await as("t1", `select name from storage.objects where bucket_id = 'resumes'`);
check("talent sees own resume", r.rows?.length === 1, r);
r = await as("admin", `select name from storage.objects where bucket_id = 'resumes'`);
check("admin sees all resumes", r.rows?.length === 1, r);
r = await db.query(`select public from storage.buckets where id = 'resumes'`);
check("resume bucket is private", r.rows[0]?.public === false, r.rows);

console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
