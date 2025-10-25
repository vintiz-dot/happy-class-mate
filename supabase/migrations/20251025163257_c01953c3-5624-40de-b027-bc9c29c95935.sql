-- Fix admin access to homework files
DROP POLICY IF EXISTS "Admins can manage homework files" ON storage.objects;

-- Create separate policies for admin CRUD operations
CREATE POLICY "Admins can select homework files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'homework'
  AND EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can insert homework files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'homework'
  AND EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can update homework files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'homework'
  AND EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can delete homework files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'homework'
  AND EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  )
);