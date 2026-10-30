-- ============================================================
-- VIJAYA TUITIONS
-- Migration 0005: Online MCQ Tests + Announcements
-- Requires migrations 0001-0004.
--
-- Security principles:
-- 1. Students cannot read answer keys.
-- 2. Students cannot directly insert or modify scores.
-- 3. Test answers are validated and scored server-side.
-- 4. Students can access only tests belonging to their teacher
--    and assigned class.
-- 5. Teachers can manage only their own tests and announcements.
-- ============================================================


-- ============================================================
-- 1. ONLINE TESTS
-- ============================================================

CREATE TABLE public.online_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    teacher_id UUID NOT NULL
        REFERENCES public.teacher_profiles(id),

    subject_id UUID NOT NULL
        REFERENCES public.subjects(id),

    class_id UUID NOT NULL
        REFERENCES public.classes(id),

    title TEXT NOT NULL,

    duration_minutes INT NOT NULL
        CHECK (duration_minutes BETWEEN 1 AND 300),

    available_from TIMESTAMPTZ NOT NULL,
    available_until TIMESTAMPTZ NOT NULL,

    published BOOLEAN NOT NULL DEFAULT FALSE,
    results_released BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    CHECK (available_until > available_from)
);


-- ============================================================
-- 2. TEST QUESTIONS
-- ============================================================

CREATE TABLE public.test_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    test_id UUID NOT NULL
        REFERENCES public.online_tests(id)
        ON DELETE CASCADE,

    position INT NOT NULL,

    body TEXT NOT NULL,

    marks NUMERIC NOT NULL DEFAULT 1
        CHECK (marks > 0),

    UNIQUE (test_id, position)
);


-- ============================================================
-- 3. TEST OPTIONS
-- ============================================================

CREATE TABLE public.test_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    question_id UUID NOT NULL
        REFERENCES public.test_questions(id)
        ON DELETE CASCADE,

    position INT NOT NULL,

    body TEXT NOT NULL,

    UNIQUE (question_id, position),

    UNIQUE (id, question_id)
);


-- ============================================================
-- 4. ANSWER KEYS
-- Students must never receive SELECT access to this table.
-- Composite FK ensures the correct option belongs to the question.
-- ============================================================

CREATE TABLE public.test_answer_keys (
    question_id UUID PRIMARY KEY
        REFERENCES public.test_questions(id)
        ON DELETE CASCADE,

    option_id UUID NOT NULL,

    CONSTRAINT test_answer_keys_option_question_fk
        FOREIGN KEY (option_id, question_id)
        REFERENCES public.test_options(id, question_id)
        ON DELETE CASCADE
);


-- ============================================================
-- 5. TEST ATTEMPTS
-- One attempt per student per test.
-- ============================================================

CREATE TABLE public.test_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    test_id UUID NOT NULL
        REFERENCES public.online_tests(id),

    student_id UUID NOT NULL
        REFERENCES public.student_profiles(id),

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    submitted_at TIMESTAMPTZ,

    UNIQUE (test_id, student_id)
);


-- ============================================================
-- 6. TEST ANSWERS
-- ============================================================

CREATE TABLE public.test_answers (
    attempt_id UUID NOT NULL
        REFERENCES public.test_attempts(id)
        ON DELETE CASCADE,

    question_id UUID NOT NULL
        REFERENCES public.test_questions(id),

    option_id UUID NOT NULL,

    PRIMARY KEY (attempt_id, question_id),

    CONSTRAINT test_answers_option_question_fk
        FOREIGN KEY (option_id, question_id)
        REFERENCES public.test_options(id, question_id)
);


-- ============================================================
-- 7. TEST RESULTS
-- ============================================================

CREATE TABLE public.test_results (
    attempt_id UUID PRIMARY KEY
        REFERENCES public.test_attempts(id)
        ON DELETE CASCADE,

    score NUMERIC NOT NULL
        CHECK (score >= 0),

    max_score NUMERIC NOT NULL
        CHECK (max_score >= 0),

    CHECK (score <= max_score)
);


-- ============================================================
-- 8. ANNOUNCEMENTS
-- ============================================================

CREATE TABLE public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    teacher_id UUID NOT NULL
        REFERENCES public.teacher_profiles(id),

    kind TEXT NOT NULL DEFAULT 'general'
        CHECK (
            kind IN (
                'general',
                'exam reminder',
                'assignment reminder'
            )
        ),

    title TEXT NOT NULL,
    body TEXT NOT NULL,

    class_id UUID
        REFERENCES public.classes(id),

    subject_id UUID
        REFERENCES public.subjects(id),

    status TEXT NOT NULL DEFAULT 'published'
        CHECK (status IN ('published', 'archived')),

    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 9. INDEXES
-- ============================================================

CREATE INDEX test_questions_test_id_idx
    ON public.test_questions(test_id);

CREATE INDEX test_options_question_id_idx
    ON public.test_options(question_id);

CREATE INDEX test_attempts_student_id_idx
    ON public.test_attempts(student_id);

CREATE INDEX announcements_status_created_idx
    ON public.announcements(status, created_at);


-- ============================================================
-- 10. ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.online_tests
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.test_questions
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.test_options
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.test_answer_keys
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.test_attempts
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.test_answers
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.test_results
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.announcements
    ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 11. ONLINE TEST POLICIES
-- ============================================================

-- Teachers manage their own tests.
CREATE POLICY ot_teacher
ON public.online_tests
FOR ALL
TO authenticated
USING (
    teacher_id = auth.uid()
)
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


-- Students read published tests belonging to their teacher and class.
CREATE POLICY ot_student
ON public.online_tests
FOR SELECT
TO authenticated
USING (
    published = TRUE

    AND EXISTS (
        SELECT 1
        FROM public.student_profiles s
        WHERE s.auth_user_id = auth.uid()
          AND s.is_active = TRUE
          AND s.class_id = online_tests.class_id
          AND s.teacher_id = online_tests.teacher_id
    )
);


-- ============================================================
-- 12. QUESTION POLICIES
-- ============================================================

CREATE POLICY tq_teacher
ON public.test_questions
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.online_tests t
        WHERE t.id = test_id
          AND t.teacher_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.online_tests t
        WHERE t.id = test_id
          AND t.teacher_id = auth.uid()
    )
);


-- Students can read questions only during an active attempt.
CREATE POLICY tq_student
ON public.test_questions
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.test_attempts a
        JOIN public.student_profiles s
          ON s.id = a.student_id
        JOIN public.online_tests t
          ON t.id = a.test_id
        WHERE a.test_id = test_questions.test_id
          AND s.auth_user_id = auth.uid()
          AND s.is_active = TRUE
          AND s.teacher_id = t.teacher_id
          AND s.class_id = t.class_id
          AND a.submitted_at IS NULL
          AND NOW() <=
              a.started_at
              + make_interval(mins => t.duration_minutes)
              + INTERVAL '30 seconds'
    )
);


-- ============================================================
-- 13. OPTION POLICIES
-- ============================================================

CREATE POLICY to_teacher
ON public.test_options
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.test_questions q
        JOIN public.online_tests t
          ON t.id = q.test_id
        WHERE q.id = question_id
          AND t.teacher_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.test_questions q
        JOIN public.online_tests t
          ON t.id = q.test_id
        WHERE q.id = question_id
          AND t.teacher_id = auth.uid()
    )
);


CREATE POLICY to_student
ON public.test_options
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.test_questions q
        JOIN public.test_attempts a
          ON a.test_id = q.test_id
        JOIN public.student_profiles s
          ON s.id = a.student_id
        JOIN public.online_tests t
          ON t.id = a.test_id
        WHERE q.id = test_options.question_id
          AND s.auth_user_id = auth.uid()
          AND s.is_active = TRUE
          AND s.teacher_id = t.teacher_id
          AND s.class_id = t.class_id
          AND a.submitted_at IS NULL
          AND NOW() <=
              a.started_at
              + make_interval(mins => t.duration_minutes)
              + INTERVAL '30 seconds'
    )
);


-- ============================================================
-- 14. ANSWER KEY POLICIES
-- Only the test's teacher can access the answer key.
-- No student SELECT policy is created.
-- ============================================================

CREATE POLICY tk_teacher
ON public.test_answer_keys
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.test_questions q
        JOIN public.online_tests t
          ON t.id = q.test_id
        WHERE q.id = question_id
          AND t.teacher_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.test_questions q
        JOIN public.online_tests t
          ON t.id = q.test_id
        WHERE q.id = question_id
          AND t.teacher_id = auth.uid()
    )
);


-- ============================================================
-- 15. ATTEMPT POLICIES
-- No direct student INSERT or UPDATE policies.
-- Attempts are created through start_test().
-- ============================================================

CREATE POLICY ta_teacher
ON public.test_attempts
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.online_tests t
        WHERE t.id = test_id
          AND t.teacher_id = auth.uid()
    )
);


CREATE POLICY ta_student
ON public.test_attempts
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.student_profiles s
        JOIN public.online_tests t
          ON t.id = test_attempts.test_id
        WHERE s.id = test_attempts.student_id
          AND s.auth_user_id = auth.uid()
          AND s.teacher_id = t.teacher_id
          AND s.class_id = t.class_id
    )
);


-- ============================================================
-- 16. ANSWER POLICIES
-- Students submit answers only through submit_test().
-- ============================================================

CREATE POLICY tans_teacher
ON public.test_answers
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.test_attempts a
        JOIN public.online_tests t
          ON t.id = a.test_id
        WHERE a.id = attempt_id
          AND t.teacher_id = auth.uid()
    )
);


-- Students can inspect their own submitted answers.
CREATE POLICY tans_student
ON public.test_answers
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.test_attempts a
        JOIN public.student_profiles s
          ON s.id = a.student_id
        WHERE a.id = attempt_id
          AND s.auth_user_id = auth.uid()
    )
);


-- ============================================================
-- 17. RESULT POLICIES
-- ============================================================

CREATE POLICY tr_teacher
ON public.test_results
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.test_attempts a
        JOIN public.online_tests t
          ON t.id = a.test_id
        WHERE a.id = attempt_id
          AND t.teacher_id = auth.uid()
    )
);


CREATE POLICY tr_student
ON public.test_results
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.test_attempts a
        JOIN public.student_profiles s
          ON s.id = a.student_id
        JOIN public.online_tests t
          ON t.id = a.test_id
        WHERE a.id = attempt_id
          AND s.auth_user_id = auth.uid()
          AND s.teacher_id = t.teacher_id
          AND s.class_id = t.class_id
          AND t.results_released = TRUE
    )
);


-- ============================================================
-- 18. ANNOUNCEMENT POLICIES
-- ============================================================

CREATE POLICY an_teacher
ON public.announcements
FOR ALL
TO authenticated
USING (
    teacher_id = auth.uid()
)
WITH CHECK (
    teacher_id = auth.uid()

    AND (
        class_id IS NULL
        OR EXISTS (
            SELECT 1
            FROM public.classes c
            WHERE c.id = class_id
              AND c.teacher_id = auth.uid()
        )
    )

    AND (
        subject_id IS NULL
        OR EXISTS (
            SELECT 1
            FROM public.subjects s
            WHERE s.id = subject_id
              AND s.teacher_id = auth.uid()
        )
    )
);


CREATE POLICY an_student
ON public.announcements
FOR SELECT
TO authenticated
USING (
    status = 'published'

    AND EXISTS (
        SELECT 1
        FROM public.student_profiles s
        WHERE s.auth_user_id = auth.uid()
          AND s.is_active = TRUE
          AND s.teacher_id = announcements.teacher_id

          AND (
              announcements.class_id IS NULL
              OR s.class_id = announcements.class_id
          )

          AND (
              announcements.subject_id IS NULL
              OR EXISTS (
                  SELECT 1
                  FROM public.student_subjects ss
                  WHERE ss.student_id = s.id
                    AND ss.subject_id = announcements.subject_id
              )
          )
    )
);


-- ============================================================
-- 19. START TEST RPC
-- Creates or returns the student's existing active attempt.
-- Students cannot start unpublished, unavailable, or unrelated tests.
-- ============================================================

CREATE OR REPLACE FUNCTION public.start_test(p_test UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_student_id UUID;
    v_teacher_id UUID;
    v_class_id UUID;
    v_attempt_id UUID;
    v_submitted_at TIMESTAMPTZ;
    v_test RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT s.id, s.teacher_id, s.class_id
    INTO v_student_id, v_teacher_id, v_class_id
    FROM public.student_profiles s
    WHERE s.auth_user_id = auth.uid()
      AND s.is_active = TRUE;

    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Active student profile not found';
    END IF;

    SELECT t.*
    INTO v_test
    FROM public.online_tests t
    WHERE t.id = p_test
      AND t.published = TRUE
      AND t.teacher_id = v_teacher_id
      AND t.class_id = v_class_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Test not available';
    END IF;

    SELECT a.id, a.submitted_at
    INTO v_attempt_id, v_submitted_at
    FROM public.test_attempts a
    WHERE a.test_id = p_test
      AND a.student_id = v_student_id;

    IF v_attempt_id IS NOT NULL THEN
        IF v_submitted_at IS NOT NULL THEN
            RAISE EXCEPTION 'Test already submitted';
        END IF;

        IF NOW() >
            (
                SELECT a.started_at
                FROM public.test_attempts a
                WHERE a.id = v_attempt_id
            )
            + make_interval(mins => v_test.duration_minutes)
            + INTERVAL '30 seconds'
        THEN
            RAISE EXCEPTION 'Test time has expired';
        END IF;

        RETURN v_attempt_id;
    END IF;

    IF NOW() < v_test.available_from
       OR NOW() > v_test.available_until THEN
        RAISE EXCEPTION 'Outside test availability window';
    END IF;

    INSERT INTO public.test_attempts (test_id, student_id)
    VALUES (p_test, v_student_id)
    RETURNING id INTO v_attempt_id;

    RETURN v_attempt_id;
END;
$$;


-- ============================================================
-- 20. SUBMIT TEST RPC
-- Validates every question and option before saving answers.
-- Calculates scores on the server.
-- Does not accept a score from the student.
-- ============================================================

CREATE OR REPLACE FUNCTION public.submit_test(
    p_attempt UUID,
    p_answers JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_attempt RECORD;
    v_test RECORD;
    v_answer RECORD;
    v_max_score NUMERIC;
    v_score NUMERIC;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_answers IS NULL
       OR jsonb_typeof(p_answers) <> 'object' THEN
        RAISE EXCEPTION 'Answers must be a JSON object';
    END IF;

    SELECT
        a.id,
        a.test_id,
        a.student_id,
        a.started_at,
        a.submitted_at,
        s.auth_user_id,
        s.teacher_id AS student_teacher_id,
        s.class_id AS student_class_id,
        s.is_active
    INTO v_attempt
    FROM public.test_attempts a
    JOIN public.student_profiles s
      ON s.id = a.student_id
    WHERE a.id = p_attempt
      AND s.auth_user_id = auth.uid();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Attempt not found';
    END IF;

    IF v_attempt.is_active IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Student account is inactive';
    END IF;

    IF v_attempt.submitted_at IS NOT NULL THEN
        RAISE EXCEPTION 'Test already submitted';
    END IF;

    SELECT t.*
    INTO v_test
    FROM public.online_tests t
    WHERE t.id = v_attempt.test_id
      AND t.teacher_id = v_attempt.student_teacher_id
      AND t.class_id = v_attempt.student_class_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Test does not belong to this student';
    END IF;

    IF NOW() >
        v_attempt.started_at
        + make_interval(mins => v_test.duration_minutes)
        + INTERVAL '30 seconds'
    THEN
        RAISE EXCEPTION 'Test time has expired';
    END IF;

    -- Reject answer keys that do not identify questions in this test,
    -- and reject options that do not belong to their specified question.
    FOR v_answer IN
        SELECT key AS question_id, value AS option_id
        FROM jsonb_each_text(p_answers)
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM public.test_questions q
            JOIN public.test_options o
              ON o.question_id = q.id
            WHERE q.id::TEXT = v_answer.question_id
              AND q.test_id = v_attempt.test_id
              AND o.id::TEXT = v_answer.option_id
        ) THEN
            RAISE EXCEPTION 'Invalid question or option in submitted answers';
        END IF;
    END LOOP;

    -- Compute the maximum possible score.
    SELECT COALESCE(SUM(q.marks), 0)
    INTO v_max_score
    FROM public.test_questions q
    WHERE q.test_id = v_attempt.test_id;

    -- Insert the validated answers.
    INSERT INTO public.test_answers (
        attempt_id,
        question_id,
        option_id
    )
    SELECT
        p_attempt,
        q.id,
        o.id
    FROM public.test_questions q
    JOIN public.test_options o
      ON o.question_id = q.id
    WHERE q.test_id = v_attempt.test_id
      AND p_answers ? q.id::TEXT
      AND o.id::TEXT = p_answers ->> q.id::TEXT;

    -- Score correct answers using the protected answer-key table.
    SELECT COALESCE(SUM(q.marks), 0)
    INTO v_score
    FROM public.test_answers ta
    JOIN public.test_answer_keys k
      ON k.question_id = ta.question_id
     AND k.option_id = ta.option_id
    JOIN public.test_questions q
      ON q.id = ta.question_id
    WHERE ta.attempt_id = p_attempt;

    INSERT INTO public.test_results (
        attempt_id,
        score,
        max_score
    )
    VALUES (
        p_attempt,
        v_score,
        v_max_score
    );

    UPDATE public.test_attempts
    SET submitted_at = NOW()
    WHERE id = p_attempt;
END;
$$;


-- ============================================================
-- 21. RESTRICT RPC EXECUTION
-- ============================================================

REVOKE ALL
ON FUNCTION public.start_test(UUID)
FROM PUBLIC, anon;

REVOKE ALL
ON FUNCTION public.submit_test(UUID, JSONB)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.start_test(UUID)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.submit_test(UUID, JSONB)
TO authenticated;


-- ============================================================
-- END OF MIGRATION 0005
-- ============================================================