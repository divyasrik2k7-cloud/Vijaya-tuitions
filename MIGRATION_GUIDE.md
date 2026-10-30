# Migrating existing Spring Boot / PostgreSQL student data (non-destructive)
The old project and its database are never modified. You only READ from it.
1. **Back up first:** `pg_dump -Fc -h <host> -U <user> <olddb> > vijaya_backup_$(date +%F).dump` and verify with `pg_restore -l <file> | head`. Keep it outside this repo.
2. **Export read-only:** in psql run `\copy (select student_code, full_name, email, guardian_name, guardian_phone from students) to 'students.csv' csv header` (adjust table/column names to your old schema; rename columns to match exactly: student_code, full_name, email, guardian_name, guardian_phone).
3. **Count baseline:** `select count(*) from students;` — note the number.
4. **Import:** log in as teacher > Import. Upload the CSV and review the preview: duplicate IDs/emails and invalid rows are listed and will be SKIPPED, never overwritten. Click Confirm only when satisfied. Each imported student receives an invitation email.
5. **Reconcile:** download the reconciliation report (line, ID, email, result). Compare: old count = imported + skipped + failed. In the new project run `select count(*) from student_profiles;`. Investigate every skipped/failed row; fix the CSV and re-run (re-running is safe, existing IDs are reported as duplicates).
6. Students without email cannot be invited; add emails first.
7. Attendance/marks history is NOT auto-migrated; keep the old project running until you have verified everything.
8. Do not delete the old project or database until the new app has been tested end to end.
