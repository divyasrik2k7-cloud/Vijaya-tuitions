-- =========================================================
-- 0006: Board-wise classes and study materials
-- =========================================================

-- 1. Add board to classes.
-- Existing classes remain NULL until the teacher assigns a board.

ALTER TABLE public.classes
ADD COLUMN IF NOT EXISTS board TEXT;

ALTER TABLE public.classes
DROP CONSTRAINT IF EXISTS classes_board_check;

ALTER TABLE public.classes
ADD CONSTRAINT classes_board_check
CHECK (
    board IS NULL OR board IN (
        'CBSE',
        'ICSE',
        'AP State Board'
    )
);

-- 2. Allow the same class name under different boards.
-- Preserve existing class records.

ALTER TABLE public.classes
DROP CONSTRAINT IF EXISTS classes_teacher_id_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS classes_teacher_board_name_key
ON public.classes (
    teacher_id,
    board,
    name
)
WHERE board IS NOT NULL;

-- 3. Add category and chapter to learning materials.

ALTER TABLE public.learning_materials
ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE public.learning_materials
ADD COLUMN IF NOT EXISTS chapter TEXT;

ALTER TABLE public.learning_materials
ADD CONSTRAINT learning_materials_category_check
CHECK (
    category IS NULL OR category IN (
        'Notes',
        'Important Questions',
        'Formulas & Shortcuts',
        'Worksheets & Assignments',
        'Question Banks',
        'Previous Year Questions',
        'Model Papers / Mock Tests',
        'Revision Materials'
    )
);
ALTER TABLE public.learning_materials
DROP CONSTRAINT IF EXISTS learning_materials_category_check;

-- 4. Add indexes for faster filtering.

CREATE INDEX IF NOT EXISTS classes_teacher_board_idx
ON public.classes (teacher_id, board);

CREATE INDEX IF NOT EXISTS learning_materials_category_idx
ON public.learning_materials (category);

CREATE INDEX IF NOT EXISTS learning_materials_chapter_idx
ON public.learning_materials (chapter);