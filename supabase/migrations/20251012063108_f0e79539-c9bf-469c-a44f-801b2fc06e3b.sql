-- Idempotent migration for attendance and invoice_sequences RLS policies
-- This migration ensures proper granular RLS policies with WITH CHECK clauses

-- =========================
-- Drop existing broad policies and create granular ones
-- =========================

-- Attendance table: Drop existing policies
DROP POLICY IF EXISTS "Admins can manage attendance" ON public.attendance;
DROP POLICY IF EXISTS "Teachers can mark attendance for their sessions" ON public.attendance;
DROP POLICY IF EXISTS "Students can view their attendance" ON public.attendance;

-- Attendance: Admin full CRUD (granular policies)
CREATE POLICY "admin_attendance_select"
ON public.attendance FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_attendance_insert"
ON public.attendance FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_attendance_update"
ON public.attendance FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_attendance_delete"
ON public.attendance FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Attendance: Teacher policies (CRUD for their own sessions)
CREATE POLICY "teacher_attendance_select"
ON public.attendance FOR SELECT
USING (
  session_id IN (
    SELECT s.id
    FROM public.sessions s
    JOIN public.teachers t ON t.id = s.teacher_id
    WHERE t.user_id = auth.uid()
  )
);

CREATE POLICY "teacher_attendance_insert"
ON public.attendance FOR INSERT
WITH CHECK (
  session_id IN (
    SELECT s.id
    FROM public.sessions s
    JOIN public.teachers t ON t.id = s.teacher_id
    WHERE t.user_id = auth.uid()
  )
);

CREATE POLICY "teacher_attendance_update"
ON public.attendance FOR UPDATE
USING (
  session_id IN (
    SELECT s.id
    FROM public.sessions s
    JOIN public.teachers t ON t.id = s.teacher_id
    WHERE t.user_id = auth.uid()
  )
)
WITH CHECK (
  session_id IN (
    SELECT s.id
    FROM public.sessions s
    JOIN public.teachers t ON t.id = s.teacher_id
    WHERE t.user_id = auth.uid()
  )
);

CREATE POLICY "teacher_attendance_delete"
ON public.attendance FOR DELETE
USING (
  session_id IN (
    SELECT s.id
    FROM public.sessions s
    JOIN public.teachers t ON t.id = s.teacher_id
    WHERE t.user_id = auth.uid()
  )
);

-- Attendance: Student/Family read-only for their own student
CREATE POLICY "student_attendance_select"
ON public.attendance FOR SELECT
USING (can_view_student(student_id, auth.uid()));

-- Add helpful indexes if not exists
CREATE INDEX IF NOT EXISTS idx_attendance_session ON public.attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON public.attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_marked_at ON public.attendance(marked_at);

-- =========================
-- Invoice sequences policies (granular)
-- =========================

-- Drop existing policy
DROP POLICY IF EXISTS "Admins can manage invoice sequences" ON public.invoice_sequences;

-- Admin full CRUD (granular)
CREATE POLICY "admin_invoice_seq_select"
ON public.invoice_sequences FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_invoice_seq_insert"
ON public.invoice_sequences FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_invoice_seq_update"
ON public.invoice_sequences FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_invoice_seq_delete"
ON public.invoice_sequences FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));