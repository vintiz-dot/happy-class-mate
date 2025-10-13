-- Update RLS policies for family access to homework and leaderboards

-- Allow family members to view and submit homework for siblings
DROP POLICY IF EXISTS "hwf_student_read" ON homework_files;
CREATE POLICY "hwf_student_read" ON homework_files
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM homeworks h
    JOIN enrollments e ON e.class_id = h.class_id
    JOIN students s ON s.id = e.student_id
    WHERE h.id = homework_files.homework_id
    AND (
      s.linked_user_id = auth.uid()
      OR s.family_id IN (
        SELECT family_id FROM students WHERE linked_user_id = auth.uid()
      )
      OR s.family_id IN (
        SELECT id FROM families WHERE primary_user_id = auth.uid()
      )
    )
  )
);

DROP POLICY IF EXISTS "Students can insert own submissions" ON homework_submissions;
CREATE POLICY "Students can insert own submissions" ON homework_submissions
FOR INSERT
WITH CHECK (
  student_id IN (
    SELECT s.id FROM students s
    WHERE s.linked_user_id = auth.uid()
    OR s.family_id IN (
      SELECT family_id FROM students WHERE linked_user_id = auth.uid()
    )
    OR s.family_id IN (
      SELECT id FROM families WHERE primary_user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Students can update own submissions" ON homework_submissions;
CREATE POLICY "Students can update own submissions" ON homework_submissions
FOR UPDATE
USING (
  student_id IN (
    SELECT s.id FROM students s
    WHERE s.linked_user_id = auth.uid()
    OR s.family_id IN (
      SELECT family_id FROM students WHERE linked_user_id = auth.uid()
    )
    OR s.family_id IN (
      SELECT id FROM families WHERE primary_user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Students can view own submissions" ON homework_submissions;
CREATE POLICY "Students can view own submissions" ON homework_submissions
FOR SELECT
USING (
  student_id IN (
    SELECT s.id FROM students s
    WHERE s.linked_user_id = auth.uid()
    OR s.family_id IN (
      SELECT family_id FROM students WHERE linked_user_id = auth.uid()
    )
    OR s.family_id IN (
      SELECT id FROM families WHERE primary_user_id = auth.uid()
    )
  )
);

-- Allow family members to view sibling leaderboards
DROP POLICY IF EXISTS "Students can view class leaderboard" ON student_points;
CREATE POLICY "Students can view class leaderboard" ON student_points
FOR SELECT
USING (
  class_id IN (
    SELECT DISTINCT e.class_id
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    WHERE s.linked_user_id = auth.uid()
    OR s.family_id IN (
      SELECT family_id FROM students WHERE linked_user_id = auth.uid()
    )
    OR s.family_id IN (
      SELECT id FROM families WHERE primary_user_id = auth.uid()
    )
  )
);