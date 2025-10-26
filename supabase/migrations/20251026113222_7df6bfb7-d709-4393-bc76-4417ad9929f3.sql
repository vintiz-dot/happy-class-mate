-- Update homework storage policies to match standardized paths
-- Drop existing policies
DROP POLICY IF EXISTS "hw_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "hw_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "hw_admin_delete" ON storage.objects;
DROP POLICY IF EXISTS "hw_student_insert" ON storage.objects;
DROP POLICY IF EXISTS "hw_teacher_insert" ON storage.objects;
DROP POLICY IF EXISTS "hw_authenticated_select" ON storage.objects;

-- Universal SELECT: All authenticated users can view all homework files
CREATE POLICY "hw_authenticated_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework'
);

-- Teachers can upload to assignments folder: assignments/{homework_id}/*
CREATE POLICY "hw_teacher_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homework' 
  AND (storage.foldername(name))[1] = 'assignments'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      has_role(auth.uid(), 'teacher'::app_role)
      AND EXISTS (
        SELECT 1 FROM homeworks h
        WHERE h.id::text = (storage.foldername(name))[2]
        AND is_teacher_of_class(auth.uid(), h.class_id)
      )
    )
  )
);

-- Students can upload to submissions folder: submissions/{homework_id}/{student_id}/*
CREATE POLICY "hw_student_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homework'
  AND (storage.foldername(name))[1] = 'submissions'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      has_role(auth.uid(), 'student'::app_role)
      AND (storage.foldername(name))[3]::uuid IN (
        SELECT id FROM students WHERE linked_user_id = auth.uid()
      )
    )
    OR (
      has_role(auth.uid(), 'family'::app_role)
      AND (storage.foldername(name))[3]::uuid IN (
        SELECT s.id FROM students s
        JOIN families f ON f.id = s.family_id
        WHERE f.primary_user_id = auth.uid()
      )
    )
  )
);

-- Admins can update any homework files
CREATE POLICY "hw_admin_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'homework'
  AND has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  bucket_id = 'homework'
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Admins can delete any homework files
CREATE POLICY "hw_admin_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'homework'
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Admin can insert anywhere in homework bucket
CREATE POLICY "hw_admin_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homework'
  AND has_role(auth.uid(), 'admin'::app_role)
);