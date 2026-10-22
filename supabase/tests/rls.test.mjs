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

console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
