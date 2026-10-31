
-- ============================================================
-- VIJAYA TUITIONS
-- Migration 0008: Multiple Question Types + Test Security
-- Preserves existing MCQ questions, attempts and results.
-- ============================================================

BEGIN;

-- 1. Add question types. Existing questions remain MCQs.

ALTER TABLE public.test_questions
ADD COLUMN question_type TEXT NOT NULL DEFAULT 'mcq'
CHECK (
    question_type IN (
        'mcq',
        'true_false',
        'fill_blank',
        'short_answer'
    )
);

-- 2. Extend student answers to support text responses.

ALTER TABLE public.test_answers
ALTER COLUMN option_id DROP NOT NULL;

ALTER TABLE public.test_answers
ADD COLUMN answer_text TEXT,
ADD COLUMN manual_score NUMERIC,
ADD COLUMN manual_feedback TEXT;

ALTER TABLE public.test_answers
ADD CONSTRAINT test_answers_one_answer_type
CHECK (
    (option_id IS NOT NULL AND answer_text IS NULL)
    OR
    (option_id IS NULL AND answer_text IS NOT NULL)
);

ALTER TABLE public.test_answers
ADD CONSTRAINT test_answers_manual_score_nonnegative
CHECK (
    manual_score IS NULL OR manual_score >= 0
);

-- 3. Protected answer keys for fill-in-the-blanks.

CREATE TABLE public.test_text_answer_keys (
    question_id UUID PRIMARY KEY
        REFERENCES public.test_questions(id)
        ON DELETE CASCADE,

    accepted_answers TEXT[] NOT NULL,

    CONSTRAINT accepted_answers_not_empty
        CHECK (
            cardinality(accepted_answers) > 0
            AND array_position(accepted_answers, NULL) IS NULL
        )
);

ALTER TABLE public.test_text_answer_keys
ENABLE ROW LEVEL SECURITY;

CREATE POLICY ttext_teacher
ON public.test_text_answer_keys
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.test_questions q
        JOIN public.online_tests t ON t.id = q.test_id
        WHERE q.id = test_text_answer_keys.question_id
          AND t.teacher_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.test_questions q
        JOIN public.online_tests t ON t.id = q.test_id
        WHERE q.id = test_text_answer_keys.question_id
          AND t.teacher_id = auth.uid()
    )
);

REVOKE ALL ON TABLE public.test_text_answer_keys
FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.test_text_answer_keys
TO authenticated;

-- 4. Separate automatic marks from manual marks.

ALTER TABLE public.test_results
ADD COLUMN auto_score NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN grading_complete BOOLEAN NOT NULL DEFAULT TRUE;

-- Preserve existing results.
UPDATE public.test_results
SET auto_score = score,
    grading_complete = TRUE;

-- 5. Restrict student test visibility to assigned subjects.

DROP POLICY IF EXISTS ot_student ON public.online_tests;

CREATE POLICY ot_student
ON public.online_tests
FOR SELECT
TO authenticated
USING (
    published = TRUE
    AND EXISTS (
        SELECT 1
        FROM public.student_profiles s
        JOIN public.student_subjects ss
          ON ss.student_id = s.id
         AND ss.subject_id = online_tests.subject_id
        WHERE s.auth_user_id = auth.uid()
          AND s.is_active = TRUE
          AND s.class_id = online_tests.class_id
          AND s.teacher_id = online_tests.teacher_id
    )
);

-- 6. Validate questions before publishing.
-- Prevent results from being released before grading is complete.

CREATE OR REPLACE FUNCTION public.validate_online_test_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.published = TRUE
       AND OLD.published IS DISTINCT FROM TRUE THEN

        IF NOT EXISTS (
            SELECT 1
            FROM public.test_questions q
            WHERE q.test_id = NEW.id
        ) THEN
            RAISE EXCEPTION
                'Add at least one question before publishing';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM public.test_questions q
            WHERE q.test_id = NEW.id
              AND (
                (
                    q.question_type = 'mcq'
                    AND (
                        (
                            SELECT COUNT(*)
                            FROM public.test_options o
                            WHERE o.question_id = q.id
                        ) < 2
                        OR NOT EXISTS (
                            SELECT 1
                            FROM public.test_answer_keys k
                            WHERE k.question_id = q.id
                        )
                        OR EXISTS (
                            SELECT 1
                            FROM public.test_text_answer_keys tk
                            WHERE tk.question_id = q.id
                        )
                    )
                )
                OR
                (
                    q.question_type = 'true_false'
                    AND (
                        (
                            SELECT COUNT(*)
                            FROM public.test_options o
                            WHERE o.question_id = q.id
                        ) <> 2
                        OR NOT EXISTS (
                            SELECT 1
                            FROM public.test_answer_keys k
                            WHERE k.question_id = q.id
                        )
                        OR EXISTS (
                            SELECT 1
                            FROM public.test_text_answer_keys tk
                            WHERE tk.question_id = q.id
                        )
                    )
                )
                OR
                (
                    q.question_type = 'fill_blank'
                    AND (
                        EXISTS (
                            SELECT 1
                            FROM public.test_options o
                            WHERE o.question_id = q.id
                        )
                        OR EXISTS (
                            SELECT 1
                            FROM public.test_answer_keys k
                            WHERE k.question_id = q.id
                        )
                        OR NOT EXISTS (
                            SELECT 1
                            FROM public.test_text_answer_keys tk
                            WHERE tk.question_id = q.id
                        )
                    )
                )
                OR
                (
                    q.question_type = 'short_answer'
                    AND (
                        EXISTS (
                            SELECT 1
                            FROM public.test_options o
                            WHERE o.question_id = q.id
                        )
                        OR EXISTS (
                            SELECT 1
                            FROM public.test_answer_keys k
                            WHERE k.question_id = q.id
                        )
                        OR EXISTS (
                            SELECT 1
                            FROM public.test_text_answer_keys tk
                            WHERE tk.question_id = q.id
                        )
                    )
                )
              )
        ) THEN
            RAISE EXCEPTION
                'One or more questions have incomplete or invalid answer configuration';
        END IF;
    END IF;

    IF NEW.results_released = TRUE
       AND OLD.results_released IS DISTINCT FROM TRUE THEN

        IF NEW.published IS DISTINCT FROM TRUE THEN
            RAISE EXCEPTION
                'Publish the test before releasing results';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM public.test_attempts at
            JOIN public.test_results r ON r.attempt_id = at.id
            WHERE at.test_id = NEW.id
              AND r.grading_complete = FALSE
        ) THEN
            RAISE EXCEPTION
                'Complete all short-answer grading before releasing results';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER validate_online_test_state_trigger
BEFORE UPDATE OF published, results_released
ON public.online_tests
FOR EACH ROW
EXECUTE FUNCTION public.validate_online_test_state();

-- 7. Replace start_test with assigned-subject validation.

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

    IF NOT EXISTS (
        SELECT 1
        FROM public.student_subjects ss
        WHERE ss.student_id = v_student_id
          AND ss.subject_id = v_test.subject_id
    ) THEN
        RAISE EXCEPTION
            'This subject is not assigned to the student';
    END IF;

    SELECT a.id, a.submitted_at
    INTO v_attempt_id, v_submitted_at
    FROM public.test_attempts a
    WHERE a.test_id = p_test
      AND a.student_id = v_student_id
    FOR UPDATE;

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

-- 8. Replace submit_test with multi-type answer support
-- and server-side automatic scoring.

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
    v_question RECORD;
    v_value TEXT;
    v_auto_score NUMERIC;
    v_max_score NUMERIC;
    v_grading_complete BOOLEAN;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_answers IS NULL
       OR jsonb_typeof(p_answers) <> 'object' THEN
        RAISE EXCEPTION
            'Answers must be a JSON object';
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
    JOIN public.student_profiles s ON s.id = a.student_id
    WHERE a.id = p_attempt
      AND s.auth_user_id = auth.uid()
    FOR UPDATE OF a;

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
        RAISE EXCEPTION
            'Test does not belong to this student';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.student_subjects ss
        WHERE ss.student_id = v_attempt.student_id
          AND ss.subject_id = v_test.subject_id
    ) THEN
        RAISE EXCEPTION
            'This subject is not assigned to the student';
    END IF;

    IF NOW() >
        v_attempt.started_at
        + make_interval(mins => v_test.duration_minutes)
        + INTERVAL '30 seconds'
    THEN
        RAISE EXCEPTION 'Test time has expired';
    END IF;

    -- Validate all submitted answers before inserting any.

    FOR v_answer IN
        SELECT key AS question_id, value AS answer_value
        FROM jsonb_each(p_answers)
    LOOP
        IF jsonb_typeof(v_answer.answer_value) <> 'string' THEN
            RAISE EXCEPTION
                'Each answer must be a string';
        END IF;

        v_value := v_answer.answer_value #>> '{}';

        SELECT q.id, q.question_type
        INTO v_question
        FROM public.test_questions q
        WHERE q.id::TEXT = v_answer.question_id
          AND q.test_id = v_attempt.test_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invalid question';
        END IF;

        IF v_question.question_type IN ('mcq', 'true_false') THEN
            IF NOT EXISTS (
                SELECT 1
                FROM public.test_options o
                WHERE o.question_id = v_question.id
                  AND o.id::TEXT = v_value
            ) THEN
                RAISE EXCEPTION 'Invalid option';
            END IF;
        ELSE
            IF length(btrim(v_value)) = 0 THEN
                RAISE EXCEPTION
                    'Text answers cannot be empty';
            END IF;

            IF length(v_value) > 5000 THEN
                RAISE EXCEPTION
                    'Text answer is too long';
            END IF;
        END IF;
    END LOOP;

    -- Save the validated answers.

    FOR v_answer IN
        SELECT key AS question_id, value AS answer_value
        FROM jsonb_each(p_answers)
    LOOP
        v_value := v_answer.answer_value #>> '{}';

        SELECT q.id, q.question_type
        INTO v_question
        FROM public.test_questions q
        WHERE q.id::TEXT = v_answer.question_id
          AND q.test_id = v_attempt.test_id;

        IF v_question.question_type IN ('mcq', 'true_false') THEN
            INSERT INTO public.test_answers (
                attempt_id,
                question_id,
                option_id
            )
            VALUES (
                p_attempt,
                v_question.id,
                v_value::UUID
            );
        ELSE
            INSERT INTO public.test_answers (
                attempt_id,
                question_id,
                answer_text
            )
            VALUES (
                p_attempt,
                v_question.id,
                v_value
            );
        END IF;
    END LOOP;

    -- Maximum possible marks include every question,
    -- including unanswered questions.

    SELECT COALESCE(SUM(q.marks), 0)
    INTO v_max_score
    FROM public.test_questions q
    WHERE q.test_id = v_attempt.test_id;

    -- Automatically score MCQs, True/False and fill blanks.
    -- Short answers are evaluated by the teacher.

    SELECT COALESCE(SUM(q.marks), 0)
    INTO v_auto_score
    FROM public.test_answers a
    JOIN public.test_questions q ON q.id = a.question_id
    LEFT JOIN public.test_answer_keys k
        ON k.question_id = q.id
    LEFT JOIN public.test_text_answer_keys tk
        ON tk.question_id = q.id
    WHERE a.attempt_id = p_attempt
      AND (
        (
            q.question_type IN ('mcq', 'true_false')
            AND a.option_id = k.option_id
        )
        OR
        (
            q.question_type = 'fill_blank'
            AND EXISTS (
                SELECT 1
                FROM unnest(tk.accepted_answers) AS accepted
                WHERE lower(btrim(accepted))
                    = lower(btrim(a.answer_text))
            )
        )
      );

    -- Only answered short-answer questions need manual grading.

    SELECT NOT EXISTS (
        SELECT 1
        FROM public.test_answers a
        JOIN public.test_questions q ON q.id = a.question_id
        WHERE a.attempt_id = p_attempt
          AND q.question_type = 'short_answer'
          AND a.manual_score IS NULL
    )
    INTO v_grading_complete;

    INSERT INTO public.test_results (
        attempt_id,
        score,
        max_score,
        auto_score,
        grading_complete
    )
    VALUES (
        p_attempt,
        v_auto_score,
        v_max_score,
        v_auto_score,
        v_grading_complete
    );

    UPDATE public.test_attempts
    SET submitted_at = NOW()
    WHERE id = p_attempt;
END;
$$;

-- 9. Teacher-only manual grading RPC.

CREATE OR REPLACE FUNCTION public.grade_test_answer(
    p_attempt UUID,
    p_question UUID,
    p_score NUMERIC,
    p_feedback TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_marks NUMERIC;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT q.marks
    INTO v_marks
    FROM public.test_answers a
    JOIN public.test_questions q ON q.id = a.question_id
    JOIN public.test_attempts at ON at.id = a.attempt_id
    JOIN public.online_tests t ON t.id = at.test_id
    WHERE a.attempt_id = p_attempt
      AND a.question_id = p_question
      AND q.question_type = 'short_answer'
      AND at.submitted_at IS NOT NULL
      AND t.teacher_id = auth.uid()
    FOR UPDATE OF a;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Short answer not found or not authorized';
    END IF;

    IF p_score IS NULL OR p_score < 0 OR p_score > v_marks THEN
        RAISE EXCEPTION
            'Manual score must be between zero and question marks';
    END IF;

    UPDATE public.test_answers
    SET manual_score = p_score,
        manual_feedback = p_feedback
    WHERE attempt_id = p_attempt
      AND question_id = p_question;

    UPDATE public.test_results r
    SET
        score = r.auto_score + COALESCE((
            SELECT SUM(a.manual_score)
            FROM public.test_answers a
            JOIN public.test_questions q ON q.id = a.question_id
            WHERE a.attempt_id = p_attempt
              AND q.question_type = 'short_answer'
        ), 0),
        grading_complete = NOT EXISTS (
            SELECT 1
            FROM public.test_answers a
            JOIN public.test_questions q ON q.id = a.question_id
            WHERE a.attempt_id = p_attempt
              AND q.question_type = 'short_answer'
              AND a.manual_score IS NULL
        )
    WHERE r.attempt_id = p_attempt;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Test result not found';
    END IF;
END;
$$;

-- 10. Restrict RPC execution.

REVOKE ALL
ON FUNCTION public.start_test(UUID)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.start_test(UUID)
TO authenticated;

REVOKE ALL
ON FUNCTION public.submit_test(UUID, JSONB)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.submit_test(UUID, JSONB)
TO authenticated;

REVOKE ALL
ON FUNCTION public.grade_test_answer(UUID, UUID, NUMERIC, TEXT)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.grade_test_answer(UUID, UUID, NUMERIC, TEXT)
TO authenticated;

COMMIT;

-- ============================================================
-- END MIGRATION 0008
-- ============================================================
