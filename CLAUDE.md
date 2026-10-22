# CLAUDE.md

Project: VAriable platform. Owner: Jhona Oquialda, founder of VAriable.

## This file overrides the parent CLAUDE.md

`C:\Users\Admin\Downloads\CLAUDE.md` belongs to a different project (FlowOS demo for VerticalAI). None of its rules apply here: not its palette, not its banned colors, not its "Tier-1 industrial OEM" confidentiality wording, not its canvas or Vite stack, not its build order. If a rule from that file seems to apply, ignore it. The long-term fix is to move this folder out of `Downloads`.

## The spec

`../VAriable-platform-plan.docx` (revision 3, October 21, 2026) is the build brief. Read the relevant section before starting a feature. If the code and the plan disagree, ask before deviating.

## What this is

One platform for VAriable, which places Philippines-based Executive Assistants and AI-enabled niche specialists with US companies. Public site, client portal, talent portal, partner access, admin back office. "Talent" means VAriable's EAs and specialists.

## Stack

- Next.js 15 (App Router, `src/` dir), React 19, TypeScript, Tailwind CSS 4
- Supabase: Postgres, Auth, Storage. Clients in `src/lib/supabase/`
- Vercel hosting. Resend for email. Stripe (test mode) later
- Migrations live in `supabase/migrations/`. Every schema change is a new migration file, never an edit to an applied one
- `npm run dev`, `npm run build`, `npm run lint`

## Roles

`admin`, `client`, `talent`, `partner`, stored in `public.profiles.role`.

- Sign-up can only create `client` or `talent`. `admin` and `partner` are set by an admin
- A user cannot change their own role (trigger `protect_profile_role`)
- Role checks in the UI use `requireRole()` from `src/lib/auth.ts`. They are convenience only; the database rules are the real gate

## Hard rules: money and privacy

These come from the plan and are not negotiable.

1. **Talent rates are private.** `talent_rates`: each talent reads and writes only their own row, admin reads all, clients and partners never. Never send a talent rate or VAriable margin to a client or partner screen, API response or email
2. **Row-level security on every table**, enabled in the same migration that creates it. No table ships without policies. Admin access goes through `public.is_admin()`
3. **Prices are calculated on the server**, never in the browser: `base = round_up(rate / (1 - margin), 5)`, `standard = round_up(base * uplift, 5)`. Margin comes from the most specific rule (client, partner, role, global). Default margin 0.45, uplift 1.2. Always round up, including partner prices
4. **Store the result.** Every placement and invoice line stores the price and the margin used, so past invoices never change
5. **Money is in cents or `numeric`**, never floating point in the database. Pricing logic has unit tests
6. **No contact before hire.** Clients see first name and last initial only. Uploaded resumes are never sent to clients; they see a profile built from structured fields
7. **No patient health data** on the platform. Healthcare talent work inside the client's systems
8. **Audit log** for every change to a rate, price rule or invoice
9. Store times in UTC. Show clients Pacific or Eastern, talent Manila time

## Product decisions already made

- Clients only see matches admin sends them (5 to 10). Card grid with Interested or Pass on desktop, swipe on mobile
- Intro videos are links (Loom or unlisted YouTube) in the MVP
- Time tracking is built in house (timer and manual entries, weekly timesheet, client approval) to replace the paid Clockify plan in Phase 4
- Partners have no login until Phase 2; admin enters partner requests with a partner flag
- Until Phase 2 messaging, VAriable relays client and talent messages by email
- The Google Sheets import is a one-time script, not a feature

## Phase 1 build order

1. Scaffold, auth with roles, RLS (done: see `supabase/migrations/`)
2. Pricing function with unit tests (done: `src/lib/pricing/`. Cents and basis points only. Use `quote()` and `resolveSettings()`; never reimplement the formula elsewhere)
3. Admin pricing settings; public "starting at" prices calculated from tier minimum rates (done: `/admin/pricing`. `tier_min_rates` and `pricing_rules` are admin only; `tiers` and `addon_packages` hold only published prices and are public. Public pages read them with `createPublicClient()` so they stay cacheable; admin saves call `revalidatePath("/")`)
4. Landing page and request form (done: landing copy in `src/content/landing.ts`, form at `/request`, questions form on the landing page, read-only `/admin/requests`, client portal lists own requests. Anyone can insert into `talent_requests` and `questions`, only form columns are granted, admin fields are reset by trigger for non-admins. Request emails to Jhona are not wired yet: needs Resend)
5. Talent sign-up and profile (done: `/apply` → `/login?role=talent` → `/talent/profile`. `talent_profiles` is talent-own and admin only; talent can only move `vetting_status` from draft to submitted, everything else is admin (trigger `guard_talent_profile`). Submitting needs Data Privacy Act consent. Resumes go to the private `resumes` bucket under `<talent_id>/`, opened only through short-lived signed links. The asking rate is saved to `talent_rates`)
6. Admin vetting queue and funnel stats, including past applicant counts (done: `/admin/vetting`, `/admin/vetting/[id]` with scorecard, status change and rate view, `/admin/funnel`. Status changes go through `set_vetting_status()` and are logged to `vetting_events` by trigger; the funnel and the supported "top X%" claim are computed in `src/lib/funnel.ts` from those events plus `historical_funnel_counts`. `profiles.email` is copied from auth at sign-up so admin can contact applicants)
7. One-time Sheets import, then review with 2 clients and 5 talent

Finish and verify each step before starting the next.

## Copy and design

- Tone: confident and warm. Never "just a VA" or "cheap help". Sell leverage, speed and reclaimed time
- Design direction: monochrome and Apple-like, modelled on aiinsiders.us. Black, white and grays only, no accent color. Inter with tight tracking, headings weight 600, two-tone hero headline (second line gray). Black pill primary buttons and outlined pill secondary buttons with a → arrow. Small uppercase tracked eyebrow labels above section titles. Square cards with 1px `#e6e6e6` hairlines, white and `#fafafa` section bands, generous whitespace, sticky translucent header
- Colors and fonts live as tokens in `src/app/globals.css`; shared button, input and label classes live in `src/components/ui.ts`. Use those instead of restyling per page. Logo is not decided yet
- Any price or claim not yet confirmed by Jhona is marked as a placeholder in code (`// TODO(confirm)`), never presented as final. "Top 1%" is only shown when the funnel stats back it

## Working notes

- Stop the dev server before `npm run build`: both write `.next/`, and a build under a running dev server breaks it with 404s
- Forms use `useActionState` and remount on an `attempt` counter (`key={state.attempt}`), because React 19's form reset does not restore `<select>` defaults

## Definition of done

- `npm test`, `npm run test:rls`, `npm run build` and `npm run lint` pass, no console errors in `npm run dev`
- New tables have RLS and policies in the same migration
- No talent rate or margin reachable by a client or partner session
- Secrets only in `.env.local`, never committed. `.env.example` lists every variable
