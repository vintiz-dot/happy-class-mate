-- Create homework_submissions table for student submissions
CREATE TABLE IF NOT EXISTS public.homework_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id UUID NOT NULL REFERENCES public.homeworks(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  submission_text TEXT,
  storage_key TEXT,
  file_name TEXT,
  file_size INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'graded', 'redo')),
  grade TEXT,
  teacher_feedback TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  graded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(homework_id, student_id)
);

-- Enable RLS
ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;

-- Students can view and submit their own homework
CREATE POLICY "Students can view own submissions"
  ON public.homework_submissions
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM public.students 
      WHERE linked_user_id = auth.uid()
        OR family_id IN (
          SELECT id FROM public.families 
          WHERE primary_user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Students can insert own submissions"
  ON public.homework_submissions
  FOR INSERT
  WITH CHECK (
    student_id IN (
      SELECT id FROM public.students 
      WHERE linked_user_id = auth.uid()
    )
  );

CREATE POLICY "Students can update own submissions"
  ON public.homework_submissions
  FOR UPDATE
  USING (
    student_id IN (
      SELECT id FROM public.students 
      WHERE linked_user_id = auth.uid()
    )
  );

-- Teachers can view and grade submissions for their classes
CREATE POLICY "Teachers can view class submissions"
  ON public.homework_submissions
  FOR SELECT
  USING (
    homework_id IN (
      SELECT h.id FROM public.homeworks h
      WHERE is_teacher_of_class(auth.uid(), h.class_id)
    )
  );

CREATE POLICY "Teachers can update submissions for grading"
  ON public.homework_submissions
  FOR UPDATE
  USING (
    homework_id IN (
      SELECT h.id FROM public.homeworks h
      WHERE is_teacher_of_class(auth.uid(), h.class_id)
    )
  );

-- Admins have full access
CREATE POLICY "Admins can manage all submissions"
  ON public.homework_submissions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger to update updated_at
CREATE TRIGGER update_homework_submissions_updated_at
  BEFORE UPDATE ON public.homework_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();