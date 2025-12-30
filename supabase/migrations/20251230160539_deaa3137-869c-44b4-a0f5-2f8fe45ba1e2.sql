-- Fix: Allow family accounts to view classmates' point history
-- Drop the existing policy and recreate with family primary_user_id check

DROP POLICY IF EXISTS "Students can view class transactions" ON point_transactions;

CREATE POLICY "Students can view class transactions" 
ON point_transactions FOR SELECT
TO authenticated
USING (
  class_id IN (
    SELECT DISTINCT e.class_id
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    WHERE s.linked_user_id = auth.uid() 
       OR s.family_id IN (
         SELECT students.family_id 
         FROM students 
         WHERE students.linked_user_id = auth.uid()
       )
       OR s.family_id IN (
         SELECT families.id 
         FROM families 
         WHERE families.primary_user_id = auth.uid()
       )
  )
);