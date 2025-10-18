-- =============================================
-- Storage Buckets for Homework and Submissions
-- =============================================

-- Create homework bucket (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('homework', 'homework', false)
ON CONFLICT (id) DO NOTHING;

-- Create submissions bucket (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('submissions', 'submissions', false)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- RLS Policies for homework bucket
-- =============================================

-- Teachers can insert/read/update homework files for their classes
CREATE POLICY "Teachers can upload homework files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homework' 
  AND (storage.foldername(name))[1] IN (
    SELECT c.id::text
    FROM classes c
    JOIN sessions s ON s.class_id = c.id
    JOIN teachers t ON t.id = s.teacher_id
    WHERE t.user_id = auth.uid()
  )
);

CREATE POLICY "Teachers and students can read homework files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework' 
  AND (
    -- Teachers can read files for their classes
    (storage.foldername(name))[1] IN (
      SELECT c.id::text
      FROM classes c
      JOIN sessions s ON s.class_id = c.id
      JOIN teachers t ON t.id = s.teacher_id
      WHERE t.user_id = auth.uid()
    )
    OR
    -- Students can read files for their enrolled classes
    (storage.foldername(name))[1] IN (
      SELECT e.class_id::text
      FROM enrollments e
      JOIN students s ON s.id = e.student_id
      WHERE (s.linked_user_id = auth.uid() OR s.family_id IN (
        SELECT family_id FROM students WHERE linked_user_id = auth.uid()
        UNION
        SELECT id FROM families WHERE primary_user_id = auth.uid()
      ))
    )
    OR
    -- Admins can read all
    has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Teachers can update homework files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'homework' 
  AND (storage.foldername(name))[1] IN (
    SELECT c.id::text
    FROM classes c
    JOIN sessions s ON s.class_id = c.id
    JOIN teachers t ON t.id = s.teacher_id
    WHERE t.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage homework files"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'homework' AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'homework' AND has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- RLS Policies for submissions bucket
-- =============================================

-- Students can insert their own submissions
CREATE POLICY "Students can upload submission files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'submissions'
  AND (storage.foldername(name))[1] IN (
    SELECT s.id::text
    FROM students s
    WHERE s.linked_user_id = auth.uid() 
      OR s.family_id IN (
        SELECT family_id FROM students WHERE linked_user_id = auth.uid()
        UNION
        SELECT id FROM families WHERE primary_user_id = auth.uid()
      )
  )
);

-- Students, teachers, and admins can read submission files
CREATE POLICY "Students teachers and admins can read submissions"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'submissions'
  AND (
    -- Student can read their own
    (storage.foldername(name))[1] IN (
      SELECT s.id::text
      FROM students s
      WHERE s.linked_user_id = auth.uid() 
        OR s.family_id IN (
          SELECT family_id FROM students WHERE linked_user_id = auth.uid()
          UNION
          SELECT id FROM families WHERE primary_user_id = auth.uid()
        )
    )
    OR
    -- Teachers can read submissions for their classes
    (storage.foldername(name))[1] IN (
      SELECT st.id::text
      FROM students st
      JOIN enrollments e ON e.student_id = st.id
      JOIN classes c ON c.id = e.class_id
      JOIN sessions s ON s.class_id = c.id
      JOIN teachers t ON t.id = s.teacher_id
      WHERE t.user_id = auth.uid()
    )
    OR
    -- Admins can read all
    has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Students can update own submission files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'submissions'
  AND (storage.foldername(name))[1] IN (
    SELECT s.id::text
    FROM students s
    WHERE s.linked_user_id = auth.uid() 
      OR s.family_id IN (
        SELECT family_id FROM students WHERE linked_user_id = auth.uid()
        UNION
        SELECT id FROM families WHERE primary_user_id = auth.uid()
      )
  )
);

CREATE POLICY "Admins can manage submission files"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'submissions' AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'submissions' AND has_role(auth.uid(), 'admin'::app_role));