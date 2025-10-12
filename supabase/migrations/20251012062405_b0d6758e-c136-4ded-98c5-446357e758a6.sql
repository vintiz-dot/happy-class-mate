-- Add attendance tracking table
CREATE TABLE public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'Present' CHECK (status IN ('Present', 'Absent', 'Excused')),
  marked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  marked_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(session_id, student_id)
);

-- Enable RLS
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage attendance"
ON public.attendance
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teachers can mark attendance for their sessions"
ON public.attendance
FOR ALL
USING (
  session_id IN (
    SELECT s.id FROM public.sessions s
    JOIN public.teachers t ON s.teacher_id = t.id
    WHERE t.user_id = auth.uid()
  )
);

CREATE POLICY "Students can view their attendance"
ON public.attendance
FOR SELECT
USING (can_view_student(student_id, auth.uid()));

-- Add per-class settings columns
ALTER TABLE public.classes
ADD COLUMN default_session_length_minutes INTEGER NOT NULL DEFAULT 90,
ADD COLUMN typical_start_times JSONB DEFAULT '["17:30", "19:00", "19:30"]'::jsonb,
ADD COLUMN teacher_lock_window_hours INTEGER NOT NULL DEFAULT 24,
ADD COLUMN allow_teacher_override BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN class_notes TEXT;

-- Add invoice number sequence tracking
CREATE TABLE IF NOT EXISTS public.invoice_sequences (
  year INTEGER NOT NULL PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage invoice sequences"
ON public.invoice_sequences
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at on attendance
CREATE TRIGGER update_attendance_updated_at
BEFORE UPDATE ON public.attendance
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();