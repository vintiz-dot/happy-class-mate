-- Allow students to see all classmates' enrollments for leaderboard display
CREATE POLICY "Students can view classmates enrollments"
ON public.enrollments
FOR SELECT
USING (
  -- User can see enrollments in any class where they have an active enrollment
  class_id IN (
    SELECT e.class_id 
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    WHERE (
      -- Direct student link
      s.linked_user_id = auth.uid()
      -- OR user is the primary family user
      OR s.family_id IN (
        SELECT id FROM families WHERE primary_user_id = auth.uid()
      )
    )
    AND e.end_date IS NULL
  )
);