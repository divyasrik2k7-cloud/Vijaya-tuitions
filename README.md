# Vijaya Tuitions

Teacher/student tuition-management web app built with React, TypeScript, Vite, Tailwind CSS, Supabase Auth/Postgres/Storage, and Netlify Functions.

## Features in this Stage 4 snapshot

- Teacher and student login with role-protected routes and password reset.
- Student provisioning by teacher invitation, student search/deactivation, and CSV import with preview/reconciliation.
- Classes, subjects, student profiles, subject assignments, attendance sessions, and attendance CSV export/reporting.
- Marks entry and release, printable student progress reports, and attendance/performance calculations.
- Private study materials, assignments, student submissions, teacher review/feedback, and signed file links.
- Online MCQ tests with server-side scoring, attempt tracking, result release, and announcements.
- Teacher dashboard with database-derived counts and attendance chart.

## Requirements

- Node.js 20 LTS recommended and npm.
- A dedicated Supabase project.
- A Netlify account for hosted deployment and the student-provisioning function.

## Local setup

1. Extract the ZIP and open a terminal in the project directory.
2. Install dependencies: `npm install`.
3. Copy `.env.example` to `.env` and fill in the browser variables. Never commit `.env`.
4. Configure the server-only variables in your local Netlify environment when using the provisioning function.
5. Follow `SETUP_GUIDE.md` and run the SQL migrations in the exact order shown there against a **new, dedicated Supabase project**.
6. Create the first teacher Auth user in Supabase and add the matching `teacher_profiles` row using that user's Auth UUID.
7. Start the app with `npm run dev` for frontend-only work, or `npx netlify dev` to test Netlify Functions locally.
8. Run `npm test` and `npm run build` before deployment.

## Environment variables

Browser-safe variables (Vite embeds these in client assets):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (publishable/anon key only; RLS must remain enabled)

Server-side Netlify variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (**secret; never prefix with `VITE_`, commit, or expose to a browser**)
- `SITE_URL`

## Deployment

See `DEPLOYMENT.md`. Configure all environment variables in Netlify and the deployed URL in Supabase Auth URL configuration. Deploy only after the build, tests, migration review, and role-isolation checks pass.

## Data safety

The SQL migrations are for a new Supabase project, not for the existing Spring Boot/PostgreSQL database. They do not migrate or modify the legacy database. See `MIGRATION_GUIDE.md`; back up the old database and export read-only before importing anything. Do not drop tables, reset databases, or delete Docker volumes as part of this process.

## Verification status

The supplied Stage 4 ZIP had not been built or tested before delivery. In this environment, dependency installation timed out because package-registry network access was unavailable, so a production build and Vitest run could not be verified here. Do not treat the project as production-ready until the checks in `TESTING.md` pass and live Supabase security checks are completed.
