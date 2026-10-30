-- Additive only: no DROP/TRUNCATE. Run in Supabase SQL editor on a NEW project.
create extension if not exists pgcrypto;
create table teacher_profiles(id uuid primary key references auth.users(id) on delete cascade, full_name text not null, created_at timestamptz default now());
create table classes(id uuid primary key default gen_random_uuid(), teacher_id uuid not null references teacher_profiles(id), name text not null, created_at timestamptz default now(), unique(teacher_id,name));
create table subjects(id uuid primary key default gen_random_uuid(), teacher_id uuid not null references teacher_profiles(id), name text not null, unique(teacher_id,name));
create table student_profiles(
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  teacher_id uuid not null references teacher_profiles(id),
  student_code text not null, full_name text not null, email text not null,
  class_id uuid references classes(id), school_name text,
  guardian_name text, guardian_phone text, notes text,
  enrolled_on date default current_date, is_active boolean not null default true,
  created_at timestamptz default now(),
  unique(teacher_id,student_code), unique(teacher_id,email));
create table student_subjects(student_id uuid references student_profiles(id) on delete cascade, subject_id uuid references subjects(id) on delete cascade, primary key(student_id,subject_id));
create table attendance(
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references student_profiles(id),
  teacher_id uuid not null references teacher_profiles(id),
  attended_on date not null, status text not null check(status in('present','absent','late')),
  note text, unique(student_id,attended_on));
create index on attendance(teacher_id,attended_on);
create index on student_profiles(teacher_id,class_id);

create function public.is_teacher() returns boolean language sql stable security definer set search_path=public as
$$ select exists(select 1 from teacher_profiles where id=auth.uid()) $$;
revoke all on function public.is_teacher() from public, anon; grant execute on function public.is_teacher() to authenticated;

alter table teacher_profiles enable row level security;
alter table classes enable row level security;
alter table subjects enable row level security;
alter table student_profiles enable row level security;
alter table student_subjects enable row level security;
alter table attendance enable row level security;

create policy tp_self on teacher_profiles for select to authenticated using(id=auth.uid());
create policy cls_teacher on classes for all to authenticated using(teacher_id=auth.uid()) with check(teacher_id=auth.uid());
create policy cls_student_read on classes for select to authenticated using(id in(select class_id from student_profiles where auth_user_id=auth.uid()));
create policy sub_teacher on subjects for all to authenticated using(teacher_id=auth.uid()) with check(teacher_id=auth.uid());
create policy sp_teacher on student_profiles for all to authenticated using(teacher_id=auth.uid()) with check(teacher_id=auth.uid());
create policy sp_self on student_profiles for select to authenticated using(auth_user_id=auth.uid());
create policy ss_teacher on student_subjects for all to authenticated using(exists(select 1 from student_profiles s where s.id=student_id and s.teacher_id=auth.uid())) with check(exists(select 1 from student_profiles s where s.id=student_id and s.teacher_id=auth.uid()));
create policy ss_self on student_subjects for select to authenticated using(exists(select 1 from student_profiles s where s.id=student_id and s.auth_user_id=auth.uid()));
create policy att_teacher on attendance for all to authenticated using(teacher_id=auth.uid()) with check(teacher_id=auth.uid() and exists(select 1 from student_profiles s where s.id=student_id and s.teacher_id=auth.uid()));
create policy att_self on attendance for select to authenticated using(exists(select 1 from student_profiles s where s.id=student_id and s.auth_user_id=auth.uid()));
-- Create first teacher (after creating the auth user in Supabase dashboard):
-- insert into teacher_profiles(id,full_name) values('<AUTH_USER_UUID>','Vijaya');
