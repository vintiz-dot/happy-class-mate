-- Emergency fix: Remove broken policy and implement with security definer function

-- Step 1: Create security definer function to get student's active class IDs
CREATE OR REPLACE FUNCTION public.get_student_active_class_ids(_user_id uuid)
RETURNS TABLE(class_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT e.class_id
  FROM enrollments e
  JOIN students s ON s.id = e.student_id
  WHERE s.linked_user_id = _user_id
    AND e.end_date IS NULL;
$$;

-- Step 2: Drop the broken policy
DROP POLICY IF EXISTS "Students can view classmate enrollments for leaderboard" ON public.enrollments;

-- Step 3: Recreate policy using security definer function (no recursion)
CREATE POLICY "Students can view classmate enrollments for leaderboard"
ON public.enrollments
FOR SELECT
TO public
USING (
  class_id IN (SELECT class_id FROM public.get_student_active_class_ids(auth.uid()))
);