-- Modify journal_entries to support class journals and private journals
-- Make student_id nullable (for class and private journals)
ALTER TABLE journal_entries 
  ALTER COLUMN student_id DROP NOT NULL;

-- Add class_id for class journals
ALTER TABLE journal_entries 
  ADD COLUMN class_id uuid REFERENCES classes(id) ON DELETE CASCADE;

-- Add is_private flag for teacher/admin private journals
ALTER TABLE journal_entries 
  ADD COLUMN is_private boolean NOT NULL DEFAULT false;

-- Add constraint: must have either student_id, class_id, or is_private
ALTER TABLE journal_entries 
  ADD CONSTRAINT journal_entry_type_check 
  CHECK (
    (student_id IS NOT NULL AND class_id IS NULL AND is_private = false) OR  -- Student journal
    (student_id IS NULL AND class_id IS NOT NULL AND is_private = false) OR  -- Class journal
    (student_id IS NULL AND class_id IS NULL AND is_private = true)          -- Private journal
  );

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Admins can manage all entries" ON journal_entries;
DROP POLICY IF EXISTS "Students can create own entries" ON journal_entries;
DROP POLICY IF EXISTS "Students can update own entries" ON journal_entries;
DROP POLICY IF EXISTS "Students can view own entries" ON journal_entries;
DROP POLICY IF EXISTS "Teachers can create class entries" ON journal_entries;
DROP POLICY IF EXISTS "Teachers can view class entries" ON journal_entries;

-- New RLS policies

-- Admins can manage all journal entries
CREATE POLICY "Admins can manage all entries" ON journal_entries
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Students can view their own student journals
CREATE POLICY "Students can view own entries" ON journal_entries
  FOR SELECT USING (
    student_id IS NOT NULL AND can_view_student(student_id, auth.uid())
  );

-- Students can view class journals for classes they're enrolled in
CREATE POLICY "Students can view class journals" ON journal_entries
  FOR SELECT USING (
    class_id IS NOT NULL AND 
    class_id IN (
      SELECT e.class_id 
      FROM enrollments e 
      JOIN students s ON s.id = e.student_id 
      WHERE can_view_student(s.id, auth.uid())
    )
  );

-- Students can create their own student journals
CREATE POLICY "Students can create own entries" ON journal_entries
  FOR INSERT WITH CHECK (
    student_id IS NOT NULL AND 
    can_view_student(student_id, auth.uid()) AND
    class_id IS NULL AND
    is_private = false
  );

-- Students can update their own student journals
CREATE POLICY "Students can update own entries" ON journal_entries
  FOR UPDATE USING (
    student_id IS NOT NULL AND can_view_student(student_id, auth.uid())
  );

-- Teachers can view student journals for their enrolled students
CREATE POLICY "Teachers can view student entries" ON journal_entries
  FOR SELECT USING (
    student_id IS NOT NULL AND
    student_id IN (
      SELECT DISTINCT e.student_id
      FROM enrollments e
      JOIN sessions s ON s.class_id = e.class_id
      JOIN teachers t ON t.id = s.teacher_id
      WHERE t.user_id = auth.uid()
    )
  );

-- Teachers can create student journals for their enrolled students
CREATE POLICY "Teachers can create student entries" ON journal_entries
  FOR INSERT WITH CHECK (
    student_id IS NOT NULL AND
    student_id IN (
      SELECT DISTINCT e.student_id
      FROM enrollments e
      JOIN sessions s ON s.class_id = e.class_id
      JOIN teachers t ON t.id = s.teacher_id
      WHERE t.user_id = auth.uid()
    ) AND
    class_id IS NULL AND
    is_private = false
  );

-- Teachers can view class journals for their classes
CREATE POLICY "Teachers can view class journals" ON journal_entries
  FOR SELECT USING (
    class_id IS NOT NULL AND is_teacher_of_class(auth.uid(), class_id)
  );

-- Teachers can create class journals for their classes
CREATE POLICY "Teachers can create class journals" ON journal_entries
  FOR INSERT WITH CHECK (
    class_id IS NOT NULL AND 
    is_teacher_of_class(auth.uid(), class_id) AND
    student_id IS NULL AND
    is_private = false
  );

-- Teachers can update class journals they created
CREATE POLICY "Teachers can update class journals" ON journal_entries
  FOR UPDATE USING (
    class_id IS NOT NULL AND is_teacher_of_class(auth.uid(), class_id)
  );

-- Teachers can view their own private journals
CREATE POLICY "Teachers can view own private journals" ON journal_entries
  FOR SELECT USING (
    is_private = true AND created_by = auth.uid()
  );

-- Teachers can create private journals
CREATE POLICY "Teachers can create private journals" ON journal_entries
  FOR INSERT WITH CHECK (
    is_private = true AND 
    student_id IS NULL AND 
    class_id IS NULL AND
    created_by = auth.uid()
  );

-- Teachers can update their own private journals
CREATE POLICY "Teachers can update private journals" ON journal_entries
  FOR UPDATE USING (
    is_private = true AND created_by = auth.uid()
  );

-- Teachers can delete their own private journals
CREATE POLICY "Teachers can delete private journals" ON journal_entries
  FOR DELETE USING (
    is_private = true AND created_by = auth.uid()
  );