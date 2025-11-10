-- Create storage buckets for avatars if they don't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('student-avatars', 'student-avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']),
  ('teacher-avatars', 'teacher-avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS Policies for student-avatars bucket
-- Allow public read access
CREATE POLICY "Public read access for student avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'student-avatars');

-- Allow authenticated users to upload their own student avatar
CREATE POLICY "Students can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'student-avatars' 
  AND auth.uid() IN (
    SELECT linked_user_id FROM students WHERE id::text = (storage.foldername(name))[1]
    UNION
    SELECT f.primary_user_id FROM students s
    JOIN families f ON s.family_id = f.id
    WHERE s.id::text = (storage.foldername(name))[1]
  )
);

-- Allow authenticated users to update their own student avatar
CREATE POLICY "Students can update their own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'student-avatars'
  AND auth.uid() IN (
    SELECT linked_user_id FROM students WHERE id::text = (storage.foldername(name))[1]
    UNION
    SELECT f.primary_user_id FROM students s
    JOIN families f ON s.family_id = f.id
    WHERE s.id::text = (storage.foldername(name))[1]
  )
);

-- Allow authenticated users to delete their own student avatar
CREATE POLICY "Students can delete their own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'student-avatars'
  AND auth.uid() IN (
    SELECT linked_user_id FROM students WHERE id::text = (storage.foldername(name))[1]
    UNION
    SELECT f.primary_user_id FROM students s
    JOIN families f ON s.family_id = f.id
    WHERE s.id::text = (storage.foldername(name))[1]
  )
);

-- RLS Policies for teacher-avatars bucket
-- Allow public read access
CREATE POLICY "Public read access for teacher avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'teacher-avatars');

-- Allow authenticated teachers to upload their own avatar
CREATE POLICY "Teachers can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'teacher-avatars' 
  AND auth.uid() IN (
    SELECT user_id FROM teachers WHERE id::text = (storage.foldername(name))[1]
  )
);

-- Allow authenticated teachers to update their own avatar
CREATE POLICY "Teachers can update their own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'teacher-avatars'
  AND auth.uid() IN (
    SELECT user_id FROM teachers WHERE id::text = (storage.foldername(name))[1]
  )
);

-- Allow authenticated teachers to delete their own avatar
CREATE POLICY "Teachers can delete their own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'teacher-avatars'
  AND auth.uid() IN (
    SELECT user_id FROM teachers WHERE id::text = (storage.foldername(name))[1]
  )
);