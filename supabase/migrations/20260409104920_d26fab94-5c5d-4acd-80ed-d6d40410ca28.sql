
-- Allow teachers to update economy settings on their own classes
CREATE POLICY "Teachers can update economy settings for their classes"
ON public.classes
FOR UPDATE
TO authenticated
USING (is_teacher_of_class(auth.uid(), id))
WITH CHECK (is_teacher_of_class(auth.uid(), id));
