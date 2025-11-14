-- Step 1: Create security definer function to check enrollment
CREATE OR REPLACE FUNCTION public.is_student_enrolled_in_class(
  user_id uuid,
  class_id_check uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM students s
    JOIN enrollments e ON e.student_id = s.id
    WHERE s.linked_user_id = user_id
      AND e.class_id = class_id_check
      AND e.end_date IS NULL
  )
$$;

-- Step 2: Drop and recreate the RLS policy on student_points
DROP POLICY IF EXISTS "Students can view class leaderboard" ON public.student_points;

CREATE POLICY "Students can view class leaderboard"
ON public.student_points
FOR SELECT
USING (
  public.is_student_enrolled_in_class(auth.uid(), class_id)
);