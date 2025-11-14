-- Fix is_student_enrolled_in_class to support family access
-- This allows family primary users and siblings to see class leaderboards

CREATE OR REPLACE FUNCTION is_student_enrolled_in_class(user_id UUID, class_id_check UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM students s
    JOIN enrollments e ON e.student_id = s.id
    WHERE (
      -- Direct student link
      s.linked_user_id = user_id
      -- OR user is the primary family user
      OR s.family_id IN (
        SELECT id FROM families WHERE primary_user_id = user_id
      )
      -- OR user is a sibling in the same family
      OR s.family_id IN (
        SELECT family_id FROM students WHERE linked_user_id = user_id
      )
    )
    AND e.class_id = class_id_check
    AND e.end_date IS NULL
  )
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;