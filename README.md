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

## Scripts

- `npm run dev`: local server on port 3000
- `npm run build`: production build
- `npm run lint`: ESLint
- `npm run test:rls`: applies the migrations to an in-memory Postgres and checks the row-level security rules (who can see talent rates, who can change roles, audit log)

## Roles

`admin`, `client`, `talent`, `partner`. Sign-up creates `client` or `talent` only. Admins grant `admin` and `partner`. Nobody can change their own role.
