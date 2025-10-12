-- Add linked_user_id column to students table
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS linked_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- Update can_view_student function to allow linked users
CREATE OR REPLACE FUNCTION public.can_view_student(student_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = student_id
    AND (
      s.linked_user_id = user_id
      OR EXISTS (
        SELECT 1 FROM public.families f
        WHERE f.id = s.family_id
        AND f.primary_user_id = user_id
      )
    )
  );
$$;

-- One-time backfill: Update sessions with attendance to 'Held' status
UPDATE public.sessions
SET status = 'Held'
WHERE status = 'Scheduled'
  AND id IN (
    SELECT DISTINCT session_id 
    FROM public.attendance
  );