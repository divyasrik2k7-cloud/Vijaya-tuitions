# Testing and release checklist

## Local automated checks

Run from the project root:

```bash
npm install
npm test
npm run build
```

Record the actual output. Do not describe a check as passed unless the command completes successfully. Fix errors and rerun the checks.

## Supabase integration/security checks

Use synthetic records in a dedicated test project, not the legacy database.

- [ ] Teacher A cannot read or change Teacher B's classes, subjects, students, attendance, assessments, marks, materials, assignments, tests, or announcements.
- [ ] Student A can read their own profile and permitted records but cannot read Student B's private profile, attendance, submissions, marks, or test attempt.
- [ ] Students cannot read answer-key rows at any point.
- [ ] Students cannot read test questions before starting an eligible published test, and cannot submit answers or scores directly through table APIs.
- [ ] A test attempt cannot be submitted twice; server-side scoring ignores invalid option IDs and rejects submissions after the allowed time.
- [ ] Unreleased marks and online-test results remain unavailable to students; releasing and hiding results changes access as intended.
- [ ] Students cannot change assignment marks, feedback, review status, or submit after the deadline/review.
- [ ] A student can access only published learning materials intended for their class.
- [ ] Signed file URLs expire and are not issued to unauthorized users.
- [ ] The teacher provisioning endpoint rejects unauthenticated users and student accounts.
- [ ] CSV import previews invalid/duplicate rows and never overwrites an existing student.
- [ ] Attendance upsert preserves the student/date/session uniqueness rule.
- [ ] Password reset and invitation links return to the correct allowed site.

## Data integrity and migration

- [ ] Back up the legacy PostgreSQL database and verify the backup can be listed/restored in a separate environment.
- [ ] Export legacy records read-only; never point Supabase migrations at the legacy database.
- [ ] Reconcile old record counts with imported, skipped, and failed rows.
- [ ] Keep the legacy app and database until the new app is validated and signed off.

## Release rule

Do not use the application with real student records until automated checks pass and live RLS/storage tests have been performed. This checklist is a plan; checked boxes must reflect tests actually completed by the operator.
