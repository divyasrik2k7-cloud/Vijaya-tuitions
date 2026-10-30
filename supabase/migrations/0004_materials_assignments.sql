-- Migration 0004: Learning materials, assignments, submissions and storage
-- Run after migrations 0001, 0002 and 0003 on the NEW Supabase project.
-- Does not modify the old Spring Boot/PostgreSQL database.

-- ============================================================
-- 1. Private storage buckets
-- ============================================================

INSERT INTO storage.buckets
    (id, name, public, file_size_limit, allowed_mime_types)
VALUES
(
    'materials',
    'materials',
    FALSE,
    10485760,
    ARRAY[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'image/png',
        'image/jpeg'
    ]
),
(
    'submissions',
    'submissions',
    FALSE,
    10485760,
    ARRAY[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'image/png',
        'image/jpeg'
    ]
)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 2. Learning materials
-- ============================================================

CREATE TABLE public.learning_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL
        REFERENCES public.teacher_profiles(id),
    subject_id UUID NOT NULL
        REFERENCES public.subjects(id),
    class_id UUID NOT NULL
        REFERENCES public.classes(id),
    title TEXT NOT NULL,
    description TEXT,
    storage_path TEXT NOT NULL UNIQUE,
    file_name TEXT NOT NULL,
    published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 3. Assignments
-- ============================================================

CREATE TABLE public.assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL
        REFERENCES public.teacher_profiles(id),
    subject_id UUID NOT NULL
        REFERENCES public.subjects(id),
    class_id UUID NOT NULL
        REFERENCES public.classes(id),
    title TEXT NOT NULL,
    instructions TEXT,
    due_at TIMESTAMPTZ NOT NULL,
    max_marks NUMERIC CHECK (
        max_marks IS NULL OR max_marks > 0
    ),
    material_id UUID
        REFERENCES public.learning_materials(id)
        ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 4. Assignment submissions
-- ============================================================

CREATE TABLE public.assignment_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL
        REFERENCES public.assignments(id)
        ON DELETE CASCADE,
    student_id UUID NOT NULL
        REFERENCES public.student_profiles(id),
    storage_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'submitted'
        CHECK (status IN ('submitted', 'reviewed')),
    marks NUMERIC,
    feedback TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (assignment_id, student_id)
);


-- ============================================================
-- 5. Indexes
-- ============================================================

CREATE INDEX learning_materials_class_id_idx
    ON public.learning_materials(class_id);

CREATE INDEX assignments_class_due_idx
    ON public.assignments(class_id, due_at);

CREATE INDEX assignment_submissions_student_id_idx
    ON public.assignment_submissions(student_id);


-- ============================================================
-- 6. Validate submission changes
-- ============================================================

CREATE OR REPLACE FUNCTION public.guard_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_due_at TIMESTAMPTZ;
    v_max_marks NUMERIC;
    v_teacher_id UUID;
    v_student_teacher_id UUID;
    v_is_teacher BOOLEAN;
BEGIN
    SELECT a.due_at, a.max_marks, a.teacher_id
    INTO v_due_at, v_max_marks, v_teacher_id
    FROM public.assignments a
    WHERE a.id = NEW.assignment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assignment not found';
    END IF;

    SELECT s.teacher_id
    INTO v_student_teacher_id
    FROM public.student_profiles s
    WHERE s.id = NEW.student_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student not found';
    END IF;

    v_is_teacher := public.is_teacher();

    -- Only the assignment's own teacher can grade submissions.
    IF v_is_teacher THEN
        IF v_teacher_id <> auth.uid()
           OR v_student_teacher_id <> auth.uid() THEN
            RAISE EXCEPTION 'Teacher cannot manage this submission';
        END IF;

        IF NEW.marks IS NOT NULL
           AND (
               NEW.marks < 0
               OR (
                   v_max_marks IS NOT NULL
                   AND NEW.marks > v_max_marks
               )
           ) THEN
            RAISE EXCEPTION 'Marks out of range';
        END IF;

        RETURN NEW;
    END IF;

    -- Students may only submit for their own teacher and their class.
    IF NEW.student_id NOT IN (
        SELECT s.id
        FROM public.student_profiles s
        WHERE s.auth_user_id = auth.uid()
          AND s.teacher_id = v_teacher_id
    ) THEN
        RAISE EXCEPTION 'Cannot submit for another student';
    END IF;

    IF NEW.assignment_id NOT IN (
        SELECT a.id
        FROM public.assignments a
        JOIN public.student_profiles s
          ON s.class_id = a.class_id
         AND s.teacher_id = a.teacher_id
        WHERE s.auth_user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Assignment is not available to this student';
    END IF;

    IF v_due_at < NOW() THEN
        RAISE EXCEPTION 'Assignment deadline passed';
    END IF;

    IF NEW.marks IS NOT NULL
       OR NEW.feedback IS NOT NULL
       OR NEW.status <> 'submitted' THEN
        RAISE EXCEPTION 'Students cannot grade submissions';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
           OR NEW.student_id IS DISTINCT FROM OLD.student_id
           OR NEW.marks IS DISTINCT FROM OLD.marks
           OR NEW.feedback IS DISTINCT FROM OLD.feedback
           OR NEW.status IS DISTINCT FROM OLD.status
           OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
            RAISE EXCEPTION 'Students cannot change protected submission fields';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_submission
BEFORE INSERT OR UPDATE
ON public.assignment_submissions
FOR EACH ROW
EXECUTE FUNCTION public.guard_submission();


-- ============================================================
-- 7. Enable Row Level Security
-- ============================================================

ALTER TABLE public.learning_materials
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.assignments
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.assignment_submissions
    ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 8. Learning materials policies
-- ============================================================

CREATE POLICY lm_teacher
ON public.learning_materials
FOR ALL
TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (
    teacher_id = auth.uid()
    AND EXISTS (
        SELECT 1
        FROM public.subjects s
        WHERE s.id = subject_id
          AND s.teacher_id = auth.uid()
    )
    AND EXISTS (
        SELECT 1
        FROM public.classes c
        WHERE c.id = class_id
          AND c.teacher_id = auth.uid()
    )
);

CREATE POLICY lm_student
ON public.learning_materials
FOR SELECT
TO authenticated
USING (
    published = TRUE
    AND EXISTS (
        SELECT 1
        FROM public.student_profiles s
        WHERE s.auth_user_id = auth.uid()
          AND s.class_id = learning_materials.class_id
          AND s.teacher_id = learning_materials.teacher_id
    )
);


-- ============================================================
-- 9. Assignment policies
-- ============================================================

CREATE POLICY asg_teacher
ON public.assignments
FOR ALL
TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (
    teacher_id = auth.uid()
    AND EXISTS (
        SELECT 1
        FROM public.subjects s
        WHERE s.id = subject_id
          AND s.teacher_id = auth.uid()
    )
    AND EXISTS (
        SELECT 1
        FROM public.classes c
        WHERE c.id = class_id
          AND c.teacher_id = auth.uid()
    )
    AND (
        material_id IS NULL
        OR EXISTS (
            SELECT 1
            FROM public.learning_materials m
            WHERE m.id = material_id
              AND m.teacher_id = auth.uid()
        )
    )
);

CREATE POLICY asg_student
ON public.assignments
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.student_profiles s
        WHERE s.auth_user_id = auth.uid()
          AND s.class_id = assignments.class_id
          AND s.teacher_id = assignments.teacher_id
    )
);


-- ============================================================
-- 10. Submission policies for teachers
-- ============================================================

CREATE POLICY sub_teacher
ON public.assignment_submissions
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.assignments a
        JOIN public.student_profiles s
          ON s.id = assignment_submissions.student_id
        WHERE a.id = assignment_submissions.assignment_id
          AND a.teacher_id = auth.uid()
          AND s.teacher_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.assignments a
        JOIN public.student_profiles s
          ON s.id = assignment_submissions.student_id
        WHERE a.id = assignment_submissions.assignment_id
          AND a.teacher_id = auth.uid()
          AND s.teacher_id = auth.uid()
    )
);


-- ============================================================
-- 11. Submission policies for students
-- ============================================================

CREATE POLICY sub_s_select
ON public.assignment_submissions
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.student_profiles s
        JOIN public.assignments a
          ON a.id = assignment_submissions.assignment_id
        WHERE s.id = assignment_submissions.student_id
          AND s.auth_user_id = auth.uid()
          AND s.teacher_id = a.teacher_id
          AND s.class_id = a.class_id
    )
);

CREATE POLICY sub_s_insert
ON public.assignment_submissions
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.student_profiles s
        JOIN public.assignments a
          ON a.id = assignment_submissions.assignment_id
        WHERE s.id = assignment_submissions.student_id
          AND s.auth_user_id = auth.uid()
          AND s.teacher_id = a.teacher_id
          AND s.class_id = a.class_id
          AND a.due_at >= NOW()
    )
);

CREATE POLICY sub_s_update
ON public.assignment_submissions
FOR UPDATE
TO authenticated
USING (
    status = 'submitted'
    AND EXISTS (
        SELECT 1
        FROM public.student_profiles s
        JOIN public.assignments a
          ON a.id = assignment_submissions.assignment_id
        WHERE s.id = assignment_submissions.student_id
          AND s.auth_user_id = auth.uid()
          AND s.teacher_id = a.teacher_id
          AND s.class_id = a.class_id
          AND a.due_at >= NOW()
    )
)
WITH CHECK (
    status = 'submitted'
    AND marks IS NULL
    AND feedback IS NULL
    AND EXISTS (
        SELECT 1
        FROM public.student_profiles s
        JOIN public.assignments a
          ON a.id = assignment_submissions.assignment_id
        WHERE s.id = assignment_submissions.student_id
          AND s.auth_user_id = auth.uid()
          AND s.teacher_id = a.teacher_id
          AND s.class_id = a.class_id
          AND a.due_at >= NOW()
    )
);


-- ============================================================
-- 12. Storage policies: learning materials
-- ============================================================

CREATE POLICY mat_teacher
ON storage.objects
FOR ALL
TO authenticated
USING (
    bucket_id = 'materials'
    AND public.is_teacher()
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
)
WITH CHECK (
    bucket_id = 'materials'
    AND public.is_teacher()
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
);

CREATE POLICY mat_student
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'materials'
    AND EXISTS (
        SELECT 1
        FROM public.learning_materials m
        JOIN public.student_profiles s
          ON s.class_id = m.class_id
         AND s.teacher_id = m.teacher_id
        WHERE m.storage_path = storage.objects.name
          AND m.published = TRUE
          AND s.auth_user_id = auth.uid()
    )
);


-- ============================================================
-- 13. Storage policies: student submissions
-- Storage path format: <student_profile_uuid>/<filename>
-- ============================================================

CREATE POLICY subf_student_ins
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'submissions'
    AND (storage.foldername(name))[1] IN (
        SELECT s.id::TEXT
        FROM public.student_profiles s
        WHERE s.auth_user_id = auth.uid()
    )
);

CREATE POLICY subf_student_sel
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'submissions'
    AND (
        (storage.foldername(name))[1] IN (
            SELECT s.id::TEXT
            FROM public.student_profiles s
            WHERE s.auth_user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1
            FROM public.student_profiles s
            WHERE s.id::TEXT = (storage.foldername(name))[1]
              AND s.teacher_id = auth.uid()
        )
    )
);

CREATE POLICY subf_student_upd
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'submissions'
    AND (storage.foldername(name))[1] IN (
        SELECT s.id::TEXT
        FROM public.student_profiles s
        WHERE s.auth_user_id = auth.uid()
    )
)
WITH CHECK (
    bucket_id = 'submissions'
    AND (storage.foldername(name))[1] IN (
        SELECT s.id::TEXT
        FROM public.student_profiles s
        WHERE s.auth_user_id = auth.uid()
    )
);