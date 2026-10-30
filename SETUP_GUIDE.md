# Setup guide

## 1. Install locally

Use Node.js 20 LTS and npm. In the project root:

```bash
npm install
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env`. Do not put the Supabase service-role key in any `VITE_` variable or frontend file.

## 2. Create and configure Supabase

Create a **new, dedicated Supabase project** for this app. Do not point these migrations at the existing Spring Boot database or a project that already contains similarly named application tables.

In the Supabase SQL Editor, run the following files one at a time, in this exact order, and stop if any statement fails:

1. `supabase/migrations/0001_core.sql`
2. `supabase/migrations/0002_student_read_subjects.sql`
3. `supabase/migrations/0003_sessions_marks.sql`
4. `supabase/migrations/0004_materials_assignments.sql`
5. `supabase/migrations/0005_tests_announcements.sql`

The obsolete `0002_learning_features.sql` file has been removed because it created legacy versions of tables that are defined again in migrations 0003–0005. Do not restore or run that obsolete migration.

Create the first teacher under Supabase Authentication. Copy the new Auth user's UUID, then run this query with the real UUID and teacher name:

```sql
insert into public.teacher_profiles (id, full_name)
values ('REPLACE-WITH-AUTH-USER-UUID', 'Teacher Name');
```

Keep the UUID in quotes. Do not share credentials or service-role keys.

## 3. Configure Auth and Netlify

In Supabase Auth URL Configuration, set the Site URL and allow the local and deployed redirect URLs. Configure email delivery and test invitation and password-reset emails.

Set these environment variables in Netlify (and locally for `netlify dev`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side secret only)
- `SITE_URL`

For local function testing, run `npx netlify dev`. `npm run dev` starts only Vite and does not provide Netlify Functions.

## 4. First checks

Run `npm install`, `npm test`, and `npm run build`. Then follow `TESTING.md`, especially the separate-teacher/separate-student authorization checks. Use synthetic test accounts and records first.

## Important

This is not a guarantee that the RLS rules have been verified against a live project. Do not use real student records until tests pass. Preserve the old Spring Boot database and take a verified backup before any data migration.
