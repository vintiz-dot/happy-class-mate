-- Fix homework_submissions RLS - ensure students can insert their own submissions
-- Drop existing restrictive policy if it exists
DROP POLICY IF EXISTS "Students can insert own submissions" ON public.homework_submissions;

-- Create proper insert policy for students
CREATE POLICY "Students can insert own submissions"
ON public.homework_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  student_id IN (
    SELECT id FROM public.students
    WHERE linked_user_id = auth.uid()
  )
);

-- Ensure storage policies allow homework uploads
DROP POLICY IF EXISTS "Students can upload homework files" ON storage.objects;
DROP POLICY IF EXISTS "Students can read their homework files" ON storage.objects;

CREATE POLICY "Students can upload homework files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homework' AND
  (storage.foldername(name))[1] = 'homework-submissions' AND
  (storage.foldername(name))[2] IN (
    SELECT id::text FROM public.students WHERE linked_user_id = auth.uid()
  )
);

CREATE POLICY "Students can read their homework files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework' AND
  (
    -- Student can read their own files
    (storage.foldername(name))[2] IN (
      SELECT id::text FROM public.students WHERE linked_user_id = auth.uid()
    ) OR
    -- Teachers can read files for their classes
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.user_id = auth.uid()
    ) OR
    -- Admins can read all
    EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
);