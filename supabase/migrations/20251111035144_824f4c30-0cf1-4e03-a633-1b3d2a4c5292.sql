-- Drop existing policies and create simpler, more reliable ones
DROP POLICY IF EXISTS "Students can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Students can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Students can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can delete their own avatar" ON storage.objects;

-- Student avatar policies with simpler logic
CREATE POLICY "Students can manage their own avatar"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'student-avatars' 
  AND (
    -- Allow if user is the student
    auth.uid()::text = (
      SELECT linked_user_id::text FROM students WHERE id::text = (storage.foldername(name))[1]
    )
    OR
    -- Allow if user is the family member
    auth.uid()::text = (
      SELECT f.primary_user_id::text FROM students s
      JOIN families f ON s.family_id = f.id
      WHERE s.id::text = (storage.foldername(name))[1]
    )
  )
)
WITH CHECK (
  bucket_id = 'student-avatars' 
  AND (
    -- Allow if user is the student
    auth.uid()::text = (
      SELECT linked_user_id::text FROM students WHERE id::text = (storage.foldername(name))[1]
    )
    OR
    -- Allow if user is the family member
    auth.uid()::text = (
      SELECT f.primary_user_id::text FROM students s
      JOIN families f ON s.family_id = f.id
      WHERE s.id::text = (storage.foldername(name))[1]
    )
  )
);

-- Teacher avatar policies with simpler logic
CREATE POLICY "Teachers can manage their own avatar"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'teacher-avatars' 
  AND auth.uid()::text = (
    SELECT user_id::text FROM teachers WHERE id::text = (storage.foldername(name))[1]
  )
)
WITH CHECK (
  bucket_id = 'teacher-avatars' 
  AND auth.uid()::text = (
    SELECT user_id::text FROM teachers WHERE id::text = (storage.foldername(name))[1]
  )
);