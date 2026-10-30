-- Migration 0003: Attendance sessions + assessments/marks
-- Run after migrations 0001 and 0002.
-- Additive schema changes; replaces the attendance uniqueness constraint
-- to support multiple sessions per student per day.

-- 1. Add attendance session support
ALTER TABLE public.attendance
ADD COLUMN IF NOT EXISTS session TEXT NOT NULL DEFAULT 'main';

-- Replace the previous unique constraint so a student can have
-- one attendance record per session per day.
ALTER TABLE public.attendance
DROP CONSTRAINT IF EXISTS attendance_student_id_attended_on_key;

ALTER TABLE public.attendance
ADD CONSTRAINT attendance_student_date_session_key
UNIQUE (student_id, attended_on, session);


-- 2. Create assessments table
CREATE TABLE public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teacher_profiles(id),
  subject_id UUID NOT NULL REFERENCES public.subjects(id),
  class_id UUID NOT NULL REFERENCES public.classes(id),
  title TEXT NOT NULL,
  max_marks NUMERIC NOT NULL CHECK (max_marks > 0),
  held_on DATE NOT NULL DEFAULT CURRENT_DATE,
  released BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- 3. Create assessment marks table
CREATE TABLE public.assessment_marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL
    REFERENCES public.assessments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL
    REFERENCES public.student_profiles(id),
  score NUMERIC NOT NULL CHECK (score >= 0),
  remarks TEXT,
  UNIQUE (assessment_id, student_id)
);


-- 4. Create indexes
CREATE INDEX IF NOT EXISTS assessments_teacher_held_on_idx
ON public.assessments (teacher_id, held_on);

CREATE INDEX IF NOT EXISTS assessment_marks_student_id_idx
ON public.assessment_marks (student_id);


-- 5. Prevent marks from exceeding the assessment's maximum marks
CREATE OR REPLACE FUNCTION public.check_mark_range()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  m NUMERIC;
BEGIN
  SELECT max_marks
  INTO m
  FROM public.assessments
  WHERE id = NEW.assessment_id;

  IF m IS NULL OR NEW.score > m THEN
    RAISE EXCEPTION 'score exceeds maximum marks';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mark_range
BEFORE INSERT OR UPDATE ON public.assessment_marks
FOR EACH ROW
EXECUTE FUNCTION public.check_mark_range();


-- 6. Enable Row Level Security
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_marks ENABLE ROW LEVEL SECURITY;


-- 7. Teachers can manage their own assessments
CREATE POLICY as_teacher
ON public.assessments
FOR ALL
TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());


-- 8. Students can read released assessments for their classes
CREATE POLICY as_student
ON public.assessments
FOR SELECT
TO authenticated
USING (
  released = TRUE
  AND class_id IN (
    SELECT class_id
    FROM public.student_profiles
    WHERE auth_user_id = auth.uid()
  )
);


-- 9. Teachers can manage marks for their own students
CREATE POLICY am_teacher
ON public.assessment_marks
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.assessments a
    WHERE a.id = assessment_marks.assessment_id
      AND a.teacher_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.assessments a
    WHERE a.id = assessment_marks.assessment_id
      AND a.teacher_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM public.student_profiles s
    WHERE s.id = assessment_marks.student_id
      AND s.teacher_id = auth.uid()
  )
);


-- 10. Students can read their own marks only when the assessment
-- is released and belongs to the same teacher as their profile.
CREATE POLICY am_student
ON public.assessment_marks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.student_profiles s
    JOIN public.assessments a
      ON a.id = assessment_marks.assessment_id
    WHERE s.id = assessment_marks.student_id
      AND s.auth_user_id = auth.uid()
      AND a.released = TRUE
      AND a.teacher_id = s.teacher_id
  )
);