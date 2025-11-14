-- Allow students to view enrollments of other students in classes where they are enrolled
CREATE POLICY "Students can view classmate enrollments for leaderboard"
ON public.enrollments
FOR SELECT
TO public
USING (
  -- Students can see enrollments in classes where they are also enrolled
  class_id IN (
    SELECT DISTINCT e.class_id
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    WHERE s.linked_user_id = auth.uid()
      AND e.end_date IS NULL  -- Only active enrollments
  )
);