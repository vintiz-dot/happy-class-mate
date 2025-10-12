-- Create session status enum
CREATE TYPE public.session_status AS ENUM ('Scheduled', 'Held', 'Canceled');

-- Create classes table
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  default_teacher_id UUID REFERENCES public.teachers(id) ON DELETE RESTRICT,
  session_rate_vnd INTEGER NOT NULL DEFAULT 210000,
  schedule_template JSONB NOT NULL DEFAULT '{"weeklySlots": []}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create sessions table
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status public.session_status NOT NULL DEFAULT 'Scheduled',
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE RESTRICT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Add indexes for performance
CREATE INDEX idx_classes_default_teacher ON public.classes(default_teacher_id);
CREATE INDEX idx_sessions_class_date ON public.sessions(class_id, date);
CREATE INDEX idx_sessions_teacher_date ON public.sessions(teacher_id, date);
CREATE INDEX idx_sessions_status ON public.sessions(status);

-- Add updated_at triggers
CREATE TRIGGER update_classes_updated_at
  BEFORE UPDATE ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for classes
CREATE POLICY "Admins can manage classes"
  ON public.classes FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Teachers can view active classes"
  ON public.classes FOR SELECT
  USING (is_active = true AND public.get_user_role(auth.uid()) = 'teacher');

CREATE POLICY "Everyone can view active classes"
  ON public.classes FOR SELECT
  USING (is_active = true);

-- RLS Policies for sessions
CREATE POLICY "Admins can manage all sessions"
  ON public.sessions FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Teachers can view their sessions"
  ON public.sessions FOR SELECT
  USING (teacher_id IN (
    SELECT t.id FROM public.teachers t WHERE t.user_id = auth.uid()
  ));

CREATE POLICY "Teachers can update their sessions"
  ON public.sessions FOR UPDATE
  USING (
    teacher_id IN (
      SELECT t.id FROM public.teachers t WHERE t.user_id = auth.uid()
    )
    AND status = 'Scheduled'
  );

CREATE POLICY "Everyone can view scheduled sessions"
  ON public.sessions FOR SELECT
  USING (status IN ('Scheduled', 'Held'));

-- Function to check for teacher double-booking
CREATE OR REPLACE FUNCTION public.check_teacher_availability(
  p_teacher_id UUID,
  p_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_exclude_session_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1
    FROM public.sessions
    WHERE teacher_id = p_teacher_id
      AND date = p_date
      AND status != 'Canceled'
      AND (id != p_exclude_session_id OR p_exclude_session_id IS NULL)
      AND (
        (start_time, end_time) OVERLAPS (p_start_time, p_end_time)
      )
  );
END;
$$;