-- Vijaya Tuitions — Migration 0009: Teacher Daily Academic Planner
-- Adds a private, teacher-owned history of daily class/subject records.
-- Does not modify or delete existing student, attendance, material or test data.

BEGIN;

CREATE TABLE public.daily_lesson_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL
        REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
    lesson_date DATE NOT NULL DEFAULT CURRENT_DATE,
    class_id UUID NOT NULL
        REFERENCES public.classes(id) ON DELETE RESTRICT,
    subject_id UUID NOT NULL
        REFERENCES public.subjects(id) ON DELETE RESTRICT,
    topic TEXT NOT NULL
        CHECK (length(btrim(topic)) > 0 AND length(topic) <= 180),
    notes TEXT,
    homework TEXT,
    status TEXT NOT NULL DEFAULT 'completed'
        CHECK (status IN ('planned', 'completed')),
    test_id UUID
        REFERENCES public.online_tests(id) ON DELETE SET NULL,
    material_id UUID
        REFERENCES public.learning_materials(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX daily_lesson_entries_teacher_date_idx
    ON public.daily_lesson_entries (teacher_id, lesson_date DESC, created_at DESC);

CREATE INDEX daily_lesson_entries_teacher_class_date_idx
    ON public.daily_lesson_entries (teacher_id, class_id, lesson_date DESC);

CREATE INDEX daily_lesson_entries_teacher_subject_date_idx
    ON public.daily_lesson_entries (teacher_id, subject_id, lesson_date DESC);

ALTER TABLE public.daily_lesson_entries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.daily_lesson_entries FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE public.daily_lesson_entries TO authenticated;

CREATE POLICY daily_lesson_teacher_all
ON public.daily_lesson_entries
FOR ALL
TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

-- Enforce that class, subject, optional test and optional material all belong
-- to the same teacher and class/subject combination.
CREATE OR REPLACE FUNCTION public.validate_daily_lesson_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.classes c
        WHERE c.id = NEW.class_id
          AND c.teacher_id = NEW.teacher_id
    ) THEN
        RAISE EXCEPTION 'Selected class does not belong to this teacher';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.subjects s
        WHERE s.id = NEW.subject_id
          AND s.teacher_id = NEW.teacher_id
    ) THEN
        RAISE EXCEPTION 'Selected subject does not belong to this teacher';
    END IF;

    IF NEW.test_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM public.online_tests t
        WHERE t.id = NEW.test_id
          AND t.teacher_id = NEW.teacher_id
          AND t.class_id = NEW.class_id
          AND t.subject_id = NEW.subject_id
    ) THEN
        RAISE EXCEPTION 'Selected test must match the teacher, class and subject';
    END IF;

    IF NEW.material_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM public.learning_materials m
        WHERE m.id = NEW.material_id
          AND m.teacher_id = NEW.teacher_id
          AND m.class_id = NEW.class_id
          AND m.subject_id = NEW.subject_id
    ) THEN
        RAISE EXCEPTION 'Selected material must match the teacher, class and subject';
    END IF;

    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER validate_daily_lesson_entry_trigger
BEFORE INSERT OR UPDATE
ON public.daily_lesson_entries
FOR EACH ROW
EXECUTE FUNCTION public.validate_daily_lesson_entry();

REVOKE ALL
ON FUNCTION public.validate_daily_lesson_entry()
FROM PUBLIC, anon, authenticated;

COMMIT;
