-- Create enrollment discount cadence enum
CREATE TYPE public.discount_cadence AS ENUM ('once', 'monthly');

-- Create enrollment discount type enum  
CREATE TYPE public.discount_type AS ENUM ('percent', 'amount');

-- Create enrollments table
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  discount_type public.discount_type,
  discount_value INTEGER,
  discount_cadence public.discount_cadence,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  CONSTRAINT unique_active_enrollment UNIQUE NULLS NOT DISTINCT (student_id, class_id, end_date)
);

-- Create index for faster queries
CREATE INDEX idx_enrollments_student ON public.enrollments(student_id);
CREATE INDEX idx_enrollments_class ON public.enrollments(class_id);
CREATE INDEX idx_enrollments_active ON public.enrollments(student_id, class_id) WHERE end_date IS NULL;

-- Create updated_at trigger
CREATE TRIGGER update_enrollments_updated_at
  BEFORE UPDATE ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for enrollments
CREATE POLICY "Admins can manage enrollments"
  ON public.enrollments
  FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Teachers can view enrollments for their classes"
  ON public.enrollments
  FOR SELECT
  USING (
    class_id IN (
      SELECT DISTINCT s.class_id
      FROM public.sessions s
      JOIN public.teachers t ON s.teacher_id = t.id
      WHERE t.user_id = auth.uid()
    )
  );

CREATE POLICY "Students can view their own enrollments"
  ON public.enrollments
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM public.students
      WHERE linked_user_id = auth.uid()
    )
  );

CREATE POLICY "Family users can view family enrollments"
  ON public.enrollments
  FOR SELECT
  USING (
    student_id IN (
      SELECT s.id FROM public.students s
      JOIN public.families f ON s.family_id = f.id
      WHERE f.primary_user_id = auth.uid()
    )
  );