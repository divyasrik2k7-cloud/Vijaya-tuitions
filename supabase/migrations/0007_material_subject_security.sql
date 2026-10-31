
-- =========================================================
-- 0007: Enforce assigned-subject access to study materials
-- =========================================================

-- Replace the previous class-only student material policy.

DROP POLICY IF EXISTS lm_student
ON public.learning_materials;

CREATE POLICY lm_student
ON public.learning_materials
FOR SELECT
TO authenticated
USING (
    published = TRUE
    AND EXISTS (
        SELECT 1
        FROM public.student_profiles s
        JOIN public.student_subjects ss
          ON ss.student_id = s.id
         AND ss.subject_id = learning_materials.subject_id
        WHERE s.auth_user_id = auth.uid()
          AND s.is_active = TRUE
          AND s.class_id = learning_materials.class_id
          AND s.teacher_id = learning_materials.teacher_id
    )
);

-- Replace the previous Storage student access policy.

DROP POLICY IF EXISTS mat_student
ON storage.objects;

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
        JOIN public.student_subjects ss
          ON ss.student_id = s.id
         AND ss.subject_id = m.subject_id
        WHERE m.storage_path = storage.objects.name
          AND m.published = TRUE
          AND s.auth_user_id = auth.uid()
          AND s.is_active = TRUE
    )
);
