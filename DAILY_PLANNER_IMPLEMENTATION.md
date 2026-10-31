# Vijaya Tuitions — Daily Academic Planner

## Implemented
- Teacher-only page at `/teacher/planner`.
- Daily records are created per class and subject.
- Fields: teaching date, class, subject, topic/chapter, teacher notes, homework/follow-up, planned/completed status.
- Optional links to an existing test and study material matching the selected class and subject.
- Edit and delete existing records.
- Previous records grouped by date, with text, class and subject filters.
- Teacher sidebar item and dashboard quick action.
- Teacher-only data access; students do not receive access to private teacher notes.

## Database migration
Apply `supabase/migrations/0009_daily_planner.sql` once in Supabase SQL Editor.
It creates `public.daily_lesson_entries`, indexes, teacher-only RLS and a trigger validating that class, subject, linked test and linked material belong to the same teacher and class/subject combination.
The migration is additive and does not alter existing student, attendance, test or material records.

## Verification
- TypeScript: `tsc --noEmit` passed after correcting Supabase nested relation typing.
- ZIP integrity: passed (`ZipFile.testzip()` returned no errors).
- Required page, route, sidebar entry and migration: confirmed present in the archive.
- Full Vite production build and Vitest could not be run in this Linux build container because the supplied node_modules are from a different platform and do not include `@rollup/rollup-linux-x64-gnu`. This is an environment/dependency limitation, not a claimed build pass. Run `npm run build` and `npm test` on the user's Mac after extracting/installing dependencies.
- Database migration has not been applied and the live Netlify site has not been changed.
