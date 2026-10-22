# Hand-off: where the VAriable platform stands

Written October 22, 2026, when the first Claude Code session moved off the original computer. A new session should read this, then `CLAUDE.md`, then the relevant part of `docs/VAriable-platform-plan.docx` (revision 3).

## Done

All Phase 1 build steps, each committed on `main`:

1. Next.js 15 + Supabase scaffold, magic-link sign-in, roles (admin, client, talent, partner) and row-level security on every table
2. Pricing function in `src/lib/pricing/` (cents and basis points, always rounds up), with unit tests matching the plan's price tables
3. Admin pricing settings at `/admin/pricing`; public "starting at" prices published from tier minimum rates
4. Landing page (copy in `src/content/landing.ts`), `/request` talent request form, "Ask a question" form, read-only `/admin/requests`, client portal request list
5. Talent sign-up (`/apply`) and profile (`/talent/profile`) with private asking rate and resume upload to a private bucket; Data Privacy Act consent required to submit
6. Admin vetting queue (`/admin/vetting`), applicant page with scorecard, status changes and rate view, funnel stats and past applicant counts (`/admin/funnel`)
7. One-time Google Sheets import: `npm run import:talent -- file.csv` (dry run by default)

Design: monochrome, Apple-like, modelled on aiinsiders.us (see `CLAUDE.md`).

Checks that pass: `npm test` (194), `npm run test:rls` (122, in-memory Postgres), `npm run lint`, `npm run build`.

## Not done yet

Nothing has run against a real database: there is no Supabase project yet. In order:

1. Create a Supabase project owned by VAriable. Run every file in `supabase/migrations/` in order. Copy `.env.example` to `.env.local` and fill it in. Add `<site>/auth/callback` to the Auth redirect URLs. Sign in, then make Jhona admin (README step 7). Open `/admin/pricing` and press Save and publish.
2. Connect this repository to Vercel and set the same environment variables there.
3. Import the talent sheet. Use `--consent-from-form` only if the original Google Form collected consent (not yet confirmed by Jhona).
4. Review with 2 clients and 5 talent.

## Open decisions (marked `TODO(confirm)` in code)

- Minimum applicants before a "top X%" claim: placeholder 300 (`src/lib/funnel.ts`)
- Early-exit fee rule for 6-month commitments (`src/lib/pricing/index.ts`)
- Tier minimum rates and AI Agent Build prices are the plan's illustrative figures until confirmed in `/admin/pricing`
- Rematch terms, perks and training schedule on the landing page must match the updated client agreement

## Not built yet

- Email notifications for new requests and questions (needs Resend)
- Two-factor login enforced for admin
- Requests board actions (status, notes), matching and the client card grid: Phase 2

## Decisions already made

- Lead generation and cold email roles map to GTM Engineer
- Time tracking is built in house (Phase 4), replacing paid Clockify
- Commits are authored Jhona Oquialda <oquialdajm@gmail.com>
