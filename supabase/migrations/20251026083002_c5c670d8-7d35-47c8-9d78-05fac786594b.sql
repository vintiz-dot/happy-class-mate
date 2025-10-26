-- Ensure homework storage bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('homework', 'homework', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Students can view homework submissions" ON storage.objects;
DROP POLICY IF EXISTS "Family can view homework submissions" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can view homework files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view homework files" ON storage.objects;
DROP POLICY IF EXISTS "Students can upload homework submissions" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can upload homework assignments" ON storage.objects;
DROP POLICY IF EXISTS "Admins can insert homework files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update homework files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete homework files" ON storage.objects;

-- Universal SELECT policies - anyone authenticated can view all homework files
CREATE POLICY "Students can view all homework files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework' 
  AND public.has_role(auth.uid(), 'student')
);

CREATE POLICY "Family can view all homework files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework' 
  AND public.has_role(auth.uid(), 'family')
);

CREATE POLICY "Teachers can view all homework files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework' 
  AND public.has_role(auth.uid(), 'teacher')
);

CREATE POLICY "Admins can view all homework files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework' 
  AND public.has_role(auth.uid(), 'admin')
);

-- INSERT policies - students upload submissions, teachers upload assignments
CREATE POLICY "Students can upload homework submissions"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homework' 
  AND public.has_role(auth.uid(), 'student')
  AND (storage.foldername(name))[1] = 'submissions'
);

CREATE POLICY "Teachers can upload homework assignments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homework' 
  AND public.has_role(auth.uid(), 'teacher')
  AND (storage.foldername(name))[1] = 'assignments'
);

CREATE POLICY "Admins can upload any homework files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homework' 
  AND public.has_role(auth.uid(), 'admin')
);

-- Admin management policies
CREATE POLICY "Admins can update any homework files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'homework' 
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete any homework files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'homework' 
  AND public.has_role(auth.uid(), 'admin')
);