-- Drop all conflicting homework storage policies
DROP POLICY IF EXISTS "Students can upload their homework" ON storage.objects;
DROP POLICY IF EXISTS "Students can view their homework" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can upload homework" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can view student homework" ON storage.objects;
DROP POLICY IF EXISTS "Public homework access" ON storage.objects;
DROP POLICY IF EXISTS "Homework files are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can upload homework files" ON storage.objects;
DROP POLICY IF EXISTS "Students can upload homework submissions" ON storage.objects;
DROP POLICY IF EXISTS "Students can view their homework submissions" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can view homework submissions" ON storage.objects;

-- Create clean, well-documented storage policies for homework bucket

-- 1. Students can upload to their own submission folder
CREATE POLICY "Students upload own homework submissions"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homework' 
  AND (storage.foldername(name))[1] = 'homework-submissions'
  AND EXISTS (
    SELECT 1 FROM public.students
    WHERE id::text = (storage.foldername(name))[2]
    AND linked_user_id = auth.uid()
  )
);

-- 2. Students can read their own submissions
CREATE POLICY "Students read own homework submissions"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework'
  AND (storage.foldername(name))[1] = 'homework-submissions'
  AND EXISTS (
    SELECT 1 FROM public.students
    WHERE id::text = (storage.foldername(name))[2]
    AND linked_user_id = auth.uid()
  )
);

-- 3. Family members can read submissions from students in their family
CREATE POLICY "Families read student homework submissions"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework'
  AND (storage.foldername(name))[1] = 'homework-submissions'
  AND EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.families f ON s.family_id = f.id
    WHERE s.id::text = (storage.foldername(name))[2]
    AND f.primary_user_id = auth.uid()
  )
);

-- 4. Teachers can upload homework materials to homework/{class_id} folders
CREATE POLICY "Teachers upload homework materials"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homework'
  AND (storage.foldername(name))[1] = 'homework'
  AND public.has_role(auth.uid(), 'teacher')
);

-- 5. Teachers can read all homework submissions for grading
CREATE POLICY "Teachers read homework submissions"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework'
  AND (storage.foldername(name))[1] = 'homework-submissions'
  AND public.has_role(auth.uid(), 'teacher')
);

-- 6. Teachers can read homework materials
CREATE POLICY "Teachers read homework materials"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework'
  AND (storage.foldername(name))[1] = 'homework'
  AND public.has_role(auth.uid(), 'teacher')
);

-- 7. Students can read homework materials (assignments)
CREATE POLICY "Students read homework materials"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework'
  AND (storage.foldername(name))[1] = 'homework'
);

-- 8. Admins can manage all homework files
CREATE POLICY "Admins manage all homework files"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'homework'
  AND public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  bucket_id = 'homework'
  AND public.has_role(auth.uid(), 'admin')
);