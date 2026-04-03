
-- Fix attendance policies to include TAs
DROP POLICY IF EXISTS "teacher_attendance_select" ON public.attendance;
DROP POLICY IF EXISTS "teacher_attendance_insert" ON public.attendance;
DROP POLICY IF EXISTS "teacher_attendance_update" ON public.attendance;
DROP POLICY IF EXISTS "teacher_attendance_delete" ON public.attendance;

CREATE POLICY "teacher_attendance_select" ON public.attendance
FOR SELECT TO authenticated
USING (
  session_id IN (
    SELECT s.id FROM sessions s JOIN teachers t ON t.id = s.teacher_id WHERE t.user_id = auth.uid()
  )
  OR session_id IN (
    SELECT sp.session_id FROM session_participants sp
    JOIN teaching_assistants ta ON ta.id = sp.teaching_assistant_id
    WHERE ta.user_id = auth.uid() AND sp.participant_type = 'teaching_assistant'
  )
);

CREATE POLICY "teacher_attendance_insert" ON public.attendance
FOR INSERT TO authenticated
WITH CHECK (
  session_id IN (
    SELECT s.id FROM sessions s JOIN teachers t ON t.id = s.teacher_id WHERE t.user_id = auth.uid()
  )
  OR session_id IN (
    SELECT sp.session_id FROM session_participants sp
    JOIN teaching_assistants ta ON ta.id = sp.teaching_assistant_id
    WHERE ta.user_id = auth.uid() AND sp.participant_type = 'teaching_assistant'
  )
);

CREATE POLICY "teacher_attendance_update" ON public.attendance
FOR UPDATE TO authenticated
USING (
  session_id IN (
    SELECT s.id FROM sessions s JOIN teachers t ON t.id = s.teacher_id WHERE t.user_id = auth.uid()
  )
  OR session_id IN (
    SELECT sp.session_id FROM session_participants sp
    JOIN teaching_assistants ta ON ta.id = sp.teaching_assistant_id
    WHERE ta.user_id = auth.uid() AND sp.participant_type = 'teaching_assistant'
  )
)
WITH CHECK (
  session_id IN (
    SELECT s.id FROM sessions s JOIN teachers t ON t.id = s.teacher_id WHERE t.user_id = auth.uid()
  )
  OR session_id IN (
    SELECT sp.session_id FROM session_participants sp
    JOIN teaching_assistants ta ON ta.id = sp.teaching_assistant_id
    WHERE ta.user_id = auth.uid() AND sp.participant_type = 'teaching_assistant'
  )
);

CREATE POLICY "teacher_attendance_delete" ON public.attendance
FOR DELETE TO authenticated
USING (
  session_id IN (
    SELECT s.id FROM sessions s JOIN teachers t ON t.id = s.teacher_id WHERE t.user_id = auth.uid()
  )
  OR session_id IN (
    SELECT sp.session_id FROM session_participants sp
    JOIN teaching_assistants ta ON ta.id = sp.teaching_assistant_id
    WHERE ta.user_id = auth.uid() AND sp.participant_type = 'teaching_assistant'
  )
);

-- Fix enrollments policy to include TAs
DROP POLICY IF EXISTS "Teachers can view enrollments for their classes" ON public.enrollments;

CREATE POLICY "Teachers can view enrollments for their classes" ON public.enrollments
FOR SELECT TO authenticated
USING (
  class_id IN (
    SELECT DISTINCT s.class_id FROM sessions s JOIN teachers t ON s.teacher_id = t.id WHERE t.user_id = auth.uid()
  )
  OR class_id IN (
    SELECT DISTINCT s.class_id FROM session_participants sp
    JOIN sessions s ON s.id = sp.session_id
    JOIN teaching_assistants ta ON ta.id = sp.teaching_assistant_id
    WHERE ta.user_id = auth.uid() AND sp.participant_type = 'teaching_assistant'
  )
);

-- Fix students policy to include TAs (currently only checks users.role = 'teacher')
DROP POLICY IF EXISTS "Teachers can view all students" ON public.students;

CREATE POLICY "Teachers can view all students" ON public.students
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'teacher')
  OR EXISTS (SELECT 1 FROM teaching_assistants ta WHERE ta.user_id = auth.uid() AND ta.is_active = true)
);
