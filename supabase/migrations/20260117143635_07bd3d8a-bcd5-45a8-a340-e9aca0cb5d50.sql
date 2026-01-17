-- Add indexes to speed up homework queries

-- Speed up homework lookups by class
CREATE INDEX IF NOT EXISTS idx_homeworks_class_id ON public.homeworks(class_id);

-- Speed up ordering by creation date  
CREATE INDEX IF NOT EXISTS idx_homeworks_created_at ON public.homeworks(created_at DESC);

-- Composite index for common query pattern (class + order by created_at)
CREATE INDEX IF NOT EXISTS idx_homeworks_class_created ON public.homeworks(class_id, created_at DESC);

-- Speed up submission lookups by student
CREATE INDEX IF NOT EXISTS idx_homework_submissions_student ON public.homework_submissions(student_id);

-- Composite index for homework + student lookup
CREATE INDEX IF NOT EXISTS idx_homework_submissions_hw_student ON public.homework_submissions(homework_id, student_id);

-- Speed up homework file lookups
CREATE INDEX IF NOT EXISTS idx_homework_files_homework ON public.homework_files(homework_id);