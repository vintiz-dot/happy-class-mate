-- Create journal_entries table
CREATE TABLE public.journal_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

-- Students can view their own entries
CREATE POLICY "Students can view own entries"
ON public.journal_entries
FOR SELECT
USING (can_view_student(student_id, auth.uid()));

-- Students can create their own entries
CREATE POLICY "Students can create own entries"
ON public.journal_entries
FOR INSERT
WITH CHECK (can_view_student(student_id, auth.uid()));

-- Students can update their own entries
CREATE POLICY "Students can update own entries"
ON public.journal_entries
FOR UPDATE
USING (can_view_student(student_id, auth.uid()));

-- Teachers can view entries for their students
CREATE POLICY "Teachers can view class entries"
ON public.journal_entries
FOR SELECT
USING (
  student_id IN (
    SELECT DISTINCT e.student_id
    FROM enrollments e
    JOIN sessions s ON s.class_id = e.class_id
    JOIN teachers t ON t.id = s.teacher_id
    WHERE t.user_id = auth.uid()
  )
);

-- Teachers can create entries for their students
CREATE POLICY "Teachers can create class entries"
ON public.journal_entries
FOR INSERT
WITH CHECK (
  student_id IN (
    SELECT DISTINCT e.student_id
    FROM enrollments e
    JOIN sessions s ON s.class_id = e.class_id
    JOIN teachers t ON t.id = s.teacher_id
    WHERE t.user_id = auth.uid()
  )
);

-- Admins can manage all entries
CREATE POLICY "Admins can manage all entries"
ON public.journal_entries
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_journal_entries_updated_at
BEFORE UPDATE ON public.journal_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();