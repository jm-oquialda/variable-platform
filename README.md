# VAriable platform

Next.js + Supabase app for VAriable: public site, client and talent portals, partner access and admin back office. The build brief is `../VAriable-platform-plan.docx`; working rules are in `CLAUDE.md`.

## Setup

1. `npm install`
2. Create a Supabase project (owned by a VAriable account).
3. In the Supabase SQL editor, run each file in `supabase/migrations/` in order. Or use the Supabase CLI: `npx supabase link` then `npx supabase db push`.
4. Copy `.env.example` to `.env.local` and fill in the URL and anon key from Project Settings > API.
5. In Supabase Auth > URL Configuration, add `http://localhost:3000/auth/callback` (and the production URL later) to the redirect URLs.
6. `npm run dev`, open http://localhost:3000, sign in with your email.
7. Make yourself admin in the SQL editor:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```
8. Open `/admin/pricing`, confirm the tier minimum rates and add-on prices (the starting values are the plan's illustrative ones), and press **Save and publish**. The home page shows no prices until then.

## Importing existing talent from Google Sheets

1. In the sheet, File > Download > Comma-separated values (.csv). Keep the column names as they are.
2. Dry run, which writes nothing and lists errors, warnings and how roles and statuses will map:
   ```bash
   npm run import:talent -- path/to/talent.csv
   ```
3. Fix any rows with errors in the sheet and export again.
4. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (Supabase: Project Settings > API), then import:
   ```bash
   npm run import:talent -- path/to/talent.csv --commit --consent-from-form
   ```
   Only use `--consent-from-form` if applicants agreed to VAriable storing their details when they applied.
5. Remove the service role key from `.env.local` when you are done.

Running it again skips anyone already imported. No emails are sent; imported talent sign in with a magic link. Resumes on Google Drive are not copied (the link is kept in the admin notes). Do not also enter imported applicants as past counts on the Funnel page.

## Scripts

- `npm run dev`: local server on port 3000
- `npm run build`: production build
- `npm run lint`: ESLint
- `npm test`: unit tests, including the pricing function checked against the plan's price tables
- `npm run test:rls`: applies the migrations to an in-memory Postgres and checks the row-level security rules (who can see talent rates, who can change roles, audit log)

## Roles

`admin`, `client`, `talent`, `partner`. Sign-up creates `client` or `talent` only. Admins grant `admin` and `partner`. Nobody can change their own role.
