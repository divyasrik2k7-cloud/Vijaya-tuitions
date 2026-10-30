-- Additive. Students may read only subjects assigned to them.
create policy sub_student_read on subjects for select to authenticated
  using (id in (select ss.subject_id from student_subjects ss join student_profiles s on s.id=ss.student_id where s.auth_user_id=auth.uid()));
