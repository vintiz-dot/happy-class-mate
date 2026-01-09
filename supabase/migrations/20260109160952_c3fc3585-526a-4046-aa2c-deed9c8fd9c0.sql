-- Security Fix: Remove overly permissive INSERT policies on system tables
-- These tables should only be written to by triggers/service role, not direct client inserts

-- 1. Drop permissive INSERT policies on notifications table
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

-- 2. Drop permissive INSERT policies on journal_audit table  
DROP POLICY IF EXISTS "System can create audit logs" ON journal_audit;

-- 3. Fix journal_members policy - make it more restrictive
-- Replace the overly permissive policy with a proper admin-only policy
DROP POLICY IF EXISTS "System can create owner memberships" ON journal_members;

-- Create a more restrictive policy that only allows:
-- 1. Admins to create any membership
-- 2. Service role (for triggers) - which bypasses RLS
-- Note: Triggers using SECURITY DEFINER functions bypass RLS anyway
CREATE POLICY "Only admins can directly insert journal_members"
  ON journal_members FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Only admins can directly insert (triggers use service role and bypass RLS)
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- 4. Make homework storage bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'homework';

-- 5. Drop overly permissive storage policy
DROP POLICY IF EXISTS "hw_authenticated_select" ON storage.objects;

-- 6. Create proper scoped storage policies for homework bucket

-- Teachers can view all homework files (they grade submissions)
CREATE POLICY "Teachers view all homework"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework'
  AND EXISTS (
    SELECT 1 FROM teachers 
    WHERE user_id = auth.uid()
  )
);

-- Admins can view all homework files
CREATE POLICY "Admins view all homework"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework'
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Students can view their own submissions
CREATE POLICY "Students view own submissions"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework'
  AND name LIKE 'submissions/%'
  AND (
    -- Extract student_id from path: submissions/{homework_id}/{student_id}/...
    -- Check if this student is linked to the current user
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.linked_user_id = auth.uid()
      AND name LIKE 'submissions/%/' || s.id::text || '/%'
    )
  )
);

-- Students can view assignment files for classes they're enrolled in
CREATE POLICY "Students view enrolled class assignments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework'
  AND name LIKE 'assignments/%'
  AND EXISTS (
    -- Check if user is a student enrolled in the class that owns this homework
    SELECT 1 FROM students s
    JOIN enrollments e ON e.student_id = s.id
    JOIN homeworks h ON h.class_id = e.class_id
    WHERE s.linked_user_id = auth.uid()
    AND name LIKE 'assignments/' || h.id::text || '/%'
  )
);