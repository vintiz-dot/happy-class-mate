-- Fix homework storage policies for teachers
-- Drop existing teacher insert policy
DROP POLICY IF EXISTS "Teachers can upload homework files" ON storage.objects;

-- Recreate with simplified logic that checks if user is a teacher
CREATE POLICY "Teachers can upload homework files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homework' 
  AND EXISTS (
    SELECT 1 FROM teachers 
    WHERE user_id = auth.uid() 
    AND is_active = true
  )
);

-- Also update the update policy to be consistent
DROP POLICY IF EXISTS "Teachers can update homework files" ON storage.objects;

CREATE POLICY "Teachers can update homework files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'homework' 
  AND EXISTS (
    SELECT 1 FROM teachers 
    WHERE user_id = auth.uid() 
    AND is_active = true
  )
);