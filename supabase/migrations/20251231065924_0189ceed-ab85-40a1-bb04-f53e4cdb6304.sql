-- Allow classmates to view each other's homework submissions
-- A classmate is someone enrolled in the same class
CREATE POLICY "Classmates can view submissions" 
ON homework_submissions FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM homeworks hw
    JOIN enrollments viewer_enroll ON viewer_enroll.class_id = hw.class_id
    JOIN students viewer ON viewer.id = viewer_enroll.student_id
    WHERE hw.id = homework_submissions.homework_id
    AND (viewer_enroll.end_date IS NULL OR viewer_enroll.end_date > CURRENT_DATE)
    AND (
      viewer.linked_user_id = auth.uid()
      OR viewer.family_id IN (SELECT id FROM families WHERE primary_user_id = auth.uid())
      OR viewer.family_id IN (SELECT family_id FROM students WHERE linked_user_id = auth.uid())
    )
  )
);

-- Allow classmates to view each other's attendance
-- A classmate is someone enrolled in the same class where the session took place
CREATE POLICY "Classmates can view attendance" 
ON attendance FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM sessions sess
    JOIN enrollments viewer_enroll ON viewer_enroll.class_id = sess.class_id
    JOIN students viewer ON viewer.id = viewer_enroll.student_id
    WHERE sess.id = attendance.session_id
    AND (viewer_enroll.end_date IS NULL OR viewer_enroll.end_date > CURRENT_DATE)
    AND (
      viewer.linked_user_id = auth.uid()
      OR viewer.family_id IN (SELECT id FROM families WHERE primary_user_id = auth.uid())
      OR viewer.family_id IN (SELECT family_id FROM students WHERE linked_user_id = auth.uid())
    )
  )
);