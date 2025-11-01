-- Drop existing journal policies
DROP POLICY IF EXISTS "Students can view their journals" ON journals;
DROP POLICY IF EXISTS "Students can create journals" ON journals;
DROP POLICY IF EXISTS "Teachers can create journals" ON journals;
DROP POLICY IF EXISTS "Members can update journals" ON journals;
DROP POLICY IF EXISTS "Owners can delete journals" ON journals;
DROP POLICY IF EXISTS "Users can create journals" ON journals;

-- Create refined journal RLS policies

-- Personal journals: Only owner can view/edit
CREATE POLICY "personal_journal_view" ON journals
FOR SELECT
USING (
  (type = 'personal' AND owner_user_id = auth.uid())
  OR has_role(auth.uid(), 'admin')
);

-- Student journals: Owner, linked student, and their teachers can view
CREATE POLICY "student_journal_view" ON journals
FOR SELECT
USING (
  (type = 'student' AND (
    owner_user_id = auth.uid()
    OR (student_id IN (
      SELECT id FROM students WHERE linked_user_id = auth.uid()
    ))
    OR is_journal_member(id, auth.uid())
  ))
  OR has_role(auth.uid(), 'admin')
);

-- Class journals: Enrolled students (read) and class teachers can view
CREATE POLICY "class_journal_view" ON journals
FOR SELECT
USING (
  (type = 'class' AND (
    -- Enrolled students can read
    class_id IN (
      SELECT e.class_id FROM enrollments e
      JOIN students s ON s.id = e.student_id
      WHERE s.linked_user_id = auth.uid()
    )
    OR
    -- Teachers of the class can read
    is_teacher_of_class(auth.uid(), class_id)
  ))
  OR has_role(auth.uid(), 'admin')
);

-- Collaborative journals: Owner and invited members can view
CREATE POLICY "collab_journal_view" ON journals
FOR SELECT
USING (
  (type = 'collab_student_teacher' AND (
    owner_user_id = auth.uid()
    OR is_journal_member(id, auth.uid())
  ))
  OR has_role(auth.uid(), 'admin')
);

-- Insert policies
CREATE POLICY "personal_journal_insert" ON journals
FOR INSERT
WITH CHECK (
  type = 'personal' 
  AND owner_user_id = auth.uid()
);

CREATE POLICY "student_journal_insert" ON journals
FOR INSERT
WITH CHECK (
  type = 'student'
  AND owner_user_id = auth.uid()
  AND (
    student_id IN (
      SELECT id FROM students WHERE linked_user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'teacher')
  )
);

CREATE POLICY "class_journal_insert" ON journals
FOR INSERT
WITH CHECK (
  type = 'class'
  AND is_teacher_of_class(auth.uid(), class_id)
);

CREATE POLICY "collab_journal_insert" ON journals
FOR INSERT
WITH CHECK (
  type = 'collab_student_teacher'
  AND owner_user_id = auth.uid()
);

-- Update policies: Members can update (but not delete for non-owners)
CREATE POLICY "personal_journal_update" ON journals
FOR UPDATE
USING (
  type = 'personal' 
  AND owner_user_id = auth.uid()
  AND NOT is_deleted
);

CREATE POLICY "student_journal_update" ON journals
FOR UPDATE
USING (
  type = 'student'
  AND (owner_user_id = auth.uid() OR is_journal_member(id, auth.uid()))
  AND NOT is_deleted
);

CREATE POLICY "class_journal_update" ON journals
FOR UPDATE
USING (
  type = 'class'
  AND is_teacher_of_class(auth.uid(), class_id)
  AND NOT is_deleted
);

CREATE POLICY "collab_journal_update" ON journals
FOR UPDATE
USING (
  type = 'collab_student_teacher'
  AND (owner_user_id = auth.uid() OR is_journal_member(id, auth.uid()))
  AND NOT is_deleted
);

CREATE POLICY "admin_journal_update" ON journals
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Delete policies: Only owners (and teachers for class journals)
CREATE POLICY "personal_journal_delete" ON journals
FOR DELETE
USING (
  type = 'personal'
  AND owner_user_id = auth.uid()
);

CREATE POLICY "student_journal_delete" ON journals
FOR DELETE
USING (
  type = 'student'
  AND owner_user_id = auth.uid()
);

CREATE POLICY "class_journal_delete" ON journals
FOR DELETE
USING (
  type = 'class'
  AND is_teacher_of_class(auth.uid(), class_id)
);

CREATE POLICY "collab_journal_delete" ON journals
FOR DELETE
USING (
  type = 'collab_student_teacher'
  AND owner_user_id = auth.uid()
);

CREATE POLICY "admin_journal_delete" ON journals
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Add avatar_url column to students table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'students' AND column_name = 'avatar_url') THEN
    ALTER TABLE students ADD COLUMN avatar_url text;
  END IF;
END $$;

-- Create storage bucket for student avatars if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-avatars', 'student-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for student avatars
DROP POLICY IF EXISTS "Students can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Students can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Students can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Students can delete own avatar" ON storage.objects;

CREATE POLICY "Students can view avatars" ON storage.objects
FOR SELECT
USING (bucket_id = 'student-avatars');

CREATE POLICY "Students can upload own avatar" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'student-avatars'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM students WHERE linked_user_id = auth.uid()
  )
);

CREATE POLICY "Students can update own avatar" ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'student-avatars'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM students WHERE linked_user_id = auth.uid()
  )
);

CREATE POLICY "Students can delete own avatar" ON storage.objects
FOR DELETE
USING (
  bucket_id = 'student-avatars'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM students WHERE linked_user_id = auth.uid()
  )
);

-- Trigger to create notification when teacher is added as journal member
CREATE OR REPLACE FUNCTION notify_journal_collaboration()
RETURNS TRIGGER AS $$
DECLARE
  journal_title text;
  journal_owner_id uuid;
BEGIN
  -- Get journal info
  SELECT title, owner_user_id INTO journal_title, journal_owner_id
  FROM journals WHERE id = NEW.journal_id;

  -- Create notification for the invited teacher
  IF NEW.role IN ('editor', 'viewer') THEN
    INSERT INTO notifications (user_id, type, title, message, journal_id, metadata)
    VALUES (
      NEW.user_id,
      'journal_collaboration',
      'Journal Collaboration Invitation',
      'You have been invited to collaborate on journal: ' || journal_title,
      NEW.journal_id,
      jsonb_build_object('role', NEW.role, 'invited_by', journal_owner_id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_journal_collaboration ON journal_members;
CREATE TRIGGER trigger_notify_journal_collaboration
AFTER INSERT ON journal_members
FOR EACH ROW
EXECUTE FUNCTION notify_journal_collaboration();