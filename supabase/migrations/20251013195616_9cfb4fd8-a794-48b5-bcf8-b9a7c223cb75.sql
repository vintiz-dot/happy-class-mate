-- Fix homework submission RLS policy for students
DROP POLICY IF EXISTS "Students can insert own submissions" ON public.homework_submissions;

CREATE POLICY "Students can insert own submissions"
ON public.homework_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  student_id IN (
    SELECT students.id 
    FROM students 
    WHERE students.linked_user_id = auth.uid()
  )
);

-- Create leaderboard tables
CREATE TABLE IF NOT EXISTS public.student_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  homework_points INTEGER NOT NULL DEFAULT 0,
  participation_points INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER GENERATED ALWAYS AS (homework_points + participation_points) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, class_id, month)
);

CREATE TABLE IF NOT EXISTS public.monthly_leaders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(class_id, month)
);

-- Enable RLS
ALTER TABLE public.student_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_leaders ENABLE ROW LEVEL SECURITY;

-- RLS policies for student_points
CREATE POLICY "Admins can manage all points"
ON public.student_points FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teachers can manage points for their classes"
ON public.student_points FOR ALL
TO authenticated
USING (is_teacher_of_class(auth.uid(), class_id))
WITH CHECK (is_teacher_of_class(auth.uid(), class_id));

CREATE POLICY "Students can view their own points"
ON public.student_points FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT id FROM students 
    WHERE linked_user_id = auth.uid()
    OR family_id IN (
      SELECT id FROM families WHERE primary_user_id = auth.uid()
    )
  )
);

CREATE POLICY "Students can view class leaderboard"
ON public.student_points FOR SELECT
TO authenticated
USING (
  class_id IN (
    SELECT DISTINCT e.class_id
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    WHERE s.linked_user_id = auth.uid()
    OR s.family_id IN (
      SELECT id FROM families WHERE primary_user_id = auth.uid()
    )
  )
);

-- RLS policies for monthly_leaders
CREATE POLICY "Admins can manage monthly leaders"
ON public.monthly_leaders FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Everyone can view monthly leaders"
ON public.monthly_leaders FOR SELECT
TO authenticated
USING (true);

-- Update trigger for student_points
CREATE OR REPLACE FUNCTION update_student_points_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_student_points_updated_at
BEFORE UPDATE ON public.student_points
FOR EACH ROW
EXECUTE FUNCTION update_student_points_timestamp();