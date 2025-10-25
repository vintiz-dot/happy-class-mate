-- Fix homework submission uploads for family accounts

-- Drop the existing policy that only checks linked_user_id
DROP POLICY IF EXISTS "Students upload own homework submissions" ON storage.objects;

-- Create new policy that includes family member access
CREATE POLICY "Students upload own homework submissions"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homework' 
  AND (storage.foldername(name))[1] = 'homework-submissions'
  AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id::text = (storage.foldername(name))[2]
    AND (
      s.linked_user_id = auth.uid()  -- Direct student account
      OR s.family_id IN (
        SELECT f.id FROM public.families f
        WHERE f.primary_user_id = auth.uid()  -- Family account
      )
    )
  )
);