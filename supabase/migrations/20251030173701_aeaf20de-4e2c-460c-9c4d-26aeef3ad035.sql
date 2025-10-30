-- Fix journal visibility for students and teachers
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Students can view class journals" ON public.journal_entries;
DROP POLICY IF EXISTS "Students can view own entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Teachers can view class journals" ON public.journal_entries;
DROP POLICY IF EXISTS "Teachers can view student entries" ON public.journal_entries;

-- Recreate with correct logic for new journals table
DROP POLICY IF EXISTS "Users can read their journals" ON public.journals;

-- Students can view journals created for them
CREATE POLICY "Students can view their journals"
ON public.journals
FOR SELECT
TO authenticated
USING (
  NOT is_deleted 
  AND (
    -- Admin can see all
    has_role(auth.uid(), 'admin'::app_role)
    -- Owner can see their own
    OR owner_user_id = auth.uid()
    -- Student can see journals about them
    OR (type = 'student' AND student_id IN (
      SELECT s.id FROM students s 
      WHERE s.linked_user_id = auth.uid() 
        OR s.family_id IN (SELECT f.id FROM families f WHERE f.primary_user_id = auth.uid())
    ))
    -- Student can see class journals for their classes
    OR (type = 'class' AND class_id IN (
      SELECT e.class_id 
      FROM enrollments e 
      JOIN students s ON s.id = e.student_id
      WHERE s.linked_user_id = auth.uid()
        OR s.family_id IN (SELECT f.id FROM families f WHERE f.primary_user_id = auth.uid())
    ))
    -- Teachers can see journals for their classes
    OR (type = 'class' AND class_id IN (
      SELECT DISTINCT s.class_id
      FROM sessions s
      JOIN teachers t ON t.id = s.teacher_id
      WHERE t.user_id = auth.uid()
    ))
    -- Teachers can see journals for students in their classes
    OR (type = 'student' AND student_id IN (
      SELECT DISTINCT e.student_id
      FROM enrollments e
      JOIN sessions s ON s.class_id = e.class_id
      JOIN teachers t ON t.id = s.teacher_id
      WHERE t.user_id = auth.uid()
    ))
    -- Member of the journal
    OR is_journal_member(id, auth.uid())
  )
);

-- Fix notification visibility
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
);