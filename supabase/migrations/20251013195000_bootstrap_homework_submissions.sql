-- Bootstrap: create homework_submissions table
-- This table was created manually in the original project (via dashboard SQL editor)
-- and is referenced by later migrations. Schema reconstructed from src/integrations/supabase/types.ts

CREATE TABLE IF NOT EXISTS public.homework_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id UUID NOT NULL REFERENCES public.homeworks(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  assignment_instructions TEXT,
  submission_text TEXT,
  file_name TEXT,
  file_size BIGINT,
  storage_key TEXT,
  grade TEXT,
  teacher_feedback TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ,
  graded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_homework_submissions_homework ON public.homework_submissions(homework_id);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_student ON public.homework_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_status ON public.homework_submissions(status);

ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_homework_submissions_updated_at ON public.homework_submissions;
CREATE TRIGGER update_homework_submissions_updated_at
  BEFORE UPDATE ON public.homework_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
