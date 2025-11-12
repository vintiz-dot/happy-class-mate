-- Add admin bypass policies for student-avatars bucket
CREATE POLICY "Admins can view all student avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'student-avatars' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can upload student avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'student-avatars' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update student avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'student-avatars' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete student avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'student-avatars' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- Add admin bypass policies for teacher-avatars bucket
CREATE POLICY "Admins can view all teacher avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'teacher-avatars' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can upload teacher avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'teacher-avatars' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update teacher avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'teacher-avatars' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete teacher avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'teacher-avatars' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);