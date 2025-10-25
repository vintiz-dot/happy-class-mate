-- Fix journal RLS policies to allow teachers and students to create journals

-- Drop overly restrictive policies
DROP POLICY IF EXISTS "Teachers can create student entries" ON public.journals;
DROP POLICY IF EXISTS "Teachers can create class journals" ON public.journals;
DROP POLICY IF EXISTS "Teachers can create private journals" ON public.journals;
DROP POLICY IF EXISTS "Students can create own entries" ON public.journals;

-- Create comprehensive insert policy for teachers
CREATE POLICY "Teachers can create journals"
ON public.journals
FOR INSERT
TO authenticated
WITH CHECK (
  owner_user_id = auth.uid()
  AND (
    -- Teacher creating any journal type
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.user_id = auth.uid()
      AND t.is_active = true
    )
  )
);

-- Create comprehensive insert policy for students
CREATE POLICY "Students can create journals"
ON public.journals
FOR INSERT
TO authenticated
WITH CHECK (
  owner_user_id = auth.uid()
  AND (
    -- Student creating personal or collaborative journals
    (type IN ('personal', 'collab_student_teacher'))
    OR
    -- Student creating journal for themselves
    (type = 'student' AND student_id IN (
      SELECT s.id FROM public.students s
      WHERE s.linked_user_id = auth.uid()
      OR s.family_id IN (
        SELECT f.id FROM public.families f
        WHERE f.primary_user_id = auth.uid()
      )
    ))
  )
);