-- Update can_view_classmate function to handle all student access patterns
CREATE OR REPLACE FUNCTION public.can_view_classmate(student_id_to_view uuid, viewer_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Check if viewer and viewed student share any active classes
  -- Viewer can be: direct student (linked_user_id), primary family user, or sibling
  SELECT EXISTS (
    SELECT 1
    FROM students viewer_student
    JOIN enrollments viewer_enrollment ON viewer_enrollment.student_id = viewer_student.id
    JOIN enrollments viewed_enrollment ON viewed_enrollment.class_id = viewer_enrollment.class_id
    WHERE (
      -- Viewer is the student directly
      viewer_student.linked_user_id = viewer_user_id
      -- OR viewer is the primary family user
      OR viewer_student.family_id IN (
        SELECT id FROM families WHERE primary_user_id = viewer_user_id
      )
      -- OR viewer is a sibling in the same family
      OR viewer_student.family_id IN (
        SELECT family_id FROM students WHERE linked_user_id = viewer_user_id
      )
    )
    AND viewed_enrollment.student_id = student_id_to_view
    AND viewer_enrollment.end_date IS NULL
    AND viewed_enrollment.end_date IS NULL
  )
$$;