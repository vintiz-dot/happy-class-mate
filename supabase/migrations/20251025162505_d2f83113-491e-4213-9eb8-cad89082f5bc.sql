-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage homework files" ON storage.objects;
DROP POLICY IF EXISTS "Students can upload homework submissions" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can upload homework files" ON storage.objects;
DROP POLICY IF EXISTS "Students can view homework files" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can view homework files" ON storage.objects;

-- Allow students and teachers to upload homework files
CREATE POLICY "Students can upload homework submissions"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'homework' 
  AND (storage.foldername(name))[1] = 'submissions'
  AND (
    auth.uid()::text IN (
      SELECT s.linked_user_id::text
      FROM students s
      WHERE s.id::text = (storage.foldername(name))[2]
    )
    OR
    auth.uid() IN (
      SELECT f.primary_user_id
      FROM students s
      JOIN families f ON s.family_id = f.id
      WHERE s.id::text = (storage.foldername(name))[2]
    )
  )
);

CREATE POLICY "Teachers can upload homework files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'homework'
  AND (storage.foldername(name))[1] = 'assignments'
  AND EXISTS (
    SELECT 1 FROM teachers t WHERE t.user_id = auth.uid()
  )
);

CREATE POLICY "Students can view homework files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'homework'
  AND (
    (
      (storage.foldername(name))[1] = 'assignments'
      AND (storage.foldername(name))[2]::uuid IN (
        SELECT h.id
        FROM homeworks h
        JOIN enrollments e ON e.class_id = h.class_id
        JOIN students s ON s.id = e.student_id
        WHERE s.linked_user_id = auth.uid()
           OR s.family_id IN (
             SELECT f.id FROM families f WHERE f.primary_user_id = auth.uid()
           )
      )
    )
    OR
    (
      (storage.foldername(name))[1] = 'submissions'
      AND (storage.foldername(name))[2]::uuid IN (
        SELECT s.id FROM students s 
        WHERE s.linked_user_id = auth.uid()
           OR s.family_id IN (
             SELECT f.id FROM families f WHERE f.primary_user_id = auth.uid()
           )
      )
    )
  )
);

CREATE POLICY "Teachers can view homework files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'homework'
  AND EXISTS (
    SELECT 1 FROM teachers t WHERE t.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage homework files"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'homework'
  AND EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  )
);