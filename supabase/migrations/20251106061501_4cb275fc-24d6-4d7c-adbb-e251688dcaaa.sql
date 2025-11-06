
-- Allow teachers to insert homework submissions for students in their classes
-- This is needed for offline grading where no submission exists yet
CREATE POLICY "Teachers can insert submissions for their classes"
ON public.homework_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  homework_id IN (
    SELECT h.id
    FROM homeworks h
    WHERE is_teacher_of_class(auth.uid(), h.class_id)
  )
);
