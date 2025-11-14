-- Step 1: Create security definer function to check if students are classmates
CREATE OR REPLACE FUNCTION public.can_view_classmate(student_id_to_view uuid, viewer_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Check if viewer and viewed student share any active classes
  SELECT EXISTS (
    SELECT 1
    FROM students viewer_student
    JOIN enrollments viewer_enrollment ON viewer_enrollment.student_id = viewer_student.id
    JOIN enrollments viewed_enrollment ON viewed_enrollment.class_id = viewer_enrollment.class_id
    WHERE viewer_student.linked_user_id = viewer_user_id
      AND viewed_enrollment.student_id = student_id_to_view
      AND viewer_enrollment.end_date IS NULL
      AND viewed_enrollment.end_date IS NULL
  )
$$;

-- Step 2: Add new RLS policy on students table for classmate visibility
CREATE POLICY "Students can view classmates for leaderboard" 
ON public.students
FOR SELECT
TO authenticated
USING (
  can_view_classmate(id, auth.uid())
);