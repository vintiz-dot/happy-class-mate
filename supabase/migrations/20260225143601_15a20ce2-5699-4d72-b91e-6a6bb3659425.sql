
-- Create feedback_reactions table for student "Thank Teacher" reactions
CREATE TABLE public.feedback_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.homework_submissions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(submission_id, student_id)
);

-- Enable RLS
ALTER TABLE public.feedback_reactions ENABLE ROW LEVEL SECURITY;

-- Students can insert their own reactions
CREATE POLICY "Students can insert own reactions"
  ON public.feedback_reactions
  FOR INSERT
  WITH CHECK (can_view_student(student_id, auth.uid()));

-- Students can view own reactions
CREATE POLICY "Students can view own reactions"
  ON public.feedback_reactions
  FOR SELECT
  USING (can_view_student(student_id, auth.uid()));

-- Teachers can view reactions on submissions they graded
CREATE POLICY "Teachers can view feedback reactions"
  ON public.feedback_reactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM homework_submissions hs
      JOIN homeworks h ON h.id = hs.homework_id
      JOIN sessions s ON s.class_id = h.class_id
      JOIN teachers t ON t.id = s.teacher_id
      WHERE hs.id = feedback_reactions.submission_id
      AND t.user_id = auth.uid()
    )
  );

-- Admins can manage all
CREATE POLICY "Admins can manage feedback reactions"
  ON public.feedback_reactions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
