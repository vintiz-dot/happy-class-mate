-- Create skill_assessments table for detailed skill tracking
CREATE TABLE public.skill_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  skill TEXT NOT NULL CHECK (skill IN ('reading', 'writing', 'listening', 'speaking', 'teamwork', 'personal')),
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  teacher_comment TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create indexes for efficient querying
CREATE INDEX idx_skill_assessments_student_date ON public.skill_assessments(student_id, date);
CREATE INDEX idx_skill_assessments_class_date ON public.skill_assessments(class_id, date);
CREATE INDEX idx_skill_assessments_skill ON public.skill_assessments(skill);

-- Enable RLS
ALTER TABLE public.skill_assessments ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage skill assessments"
ON public.skill_assessments FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Teachers can manage assessments for their classes
CREATE POLICY "Teachers can manage class skill assessments"
ON public.skill_assessments FOR ALL
TO authenticated
USING (is_teacher_of_class(auth.uid(), class_id))
WITH CHECK (is_teacher_of_class(auth.uid(), class_id));

-- Students can view their own assessments and classmates (for radar chart comparison)
CREATE POLICY "Students can view class skill assessments"
ON public.skill_assessments FOR SELECT
TO authenticated
USING (
  class_id IN (
    SELECT DISTINCT e.class_id
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    WHERE s.linked_user_id = auth.uid() 
       OR s.family_id IN (
         SELECT students.family_id 
         FROM students 
         WHERE students.linked_user_id = auth.uid()
       )
       OR s.family_id IN (
         SELECT families.id 
         FROM families 
         WHERE families.primary_user_id = auth.uid()
       )
  )
);