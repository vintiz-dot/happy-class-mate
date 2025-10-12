-- Create homework tables and storage
CREATE TABLE IF NOT EXISTS public.homeworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  due_date date,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.homework_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id uuid NOT NULL REFERENCES public.homeworks(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_key text NOT NULL,
  size_bytes int NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Helper function to check if user is teacher of a class
CREATE OR REPLACE FUNCTION public.is_teacher_of_class(user_id uuid, class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sessions s
    JOIN public.teachers t ON t.id = s.teacher_id
    WHERE s.class_id = is_teacher_of_class.class_id
    AND t.user_id = is_teacher_of_class.user_id
  );
$$;

-- Enable RLS
ALTER TABLE public.homeworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_files ENABLE ROW LEVEL SECURITY;

-- Homework RLS policies
CREATE POLICY hw_admin_all ON public.homeworks
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY hw_teacher_all ON public.homeworks
FOR ALL USING (is_teacher_of_class(auth.uid(), class_id))
WITH CHECK (is_teacher_of_class(auth.uid(), class_id));

CREATE POLICY hw_student_read ON public.homeworks
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.enrollments e
    JOIN public.students s ON s.id = e.student_id
    WHERE e.class_id = homeworks.class_id
    AND (s.linked_user_id = auth.uid() OR s.family_id IN (
      SELECT id FROM public.families WHERE primary_user_id = auth.uid()
    ))
  )
);

-- Homework files RLS policies
CREATE POLICY hwf_admin_all ON public.homework_files
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY hwf_teacher_all ON public.homework_files
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.homeworks h
    WHERE h.id = homework_files.homework_id
    AND is_teacher_of_class(auth.uid(), h.class_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.homeworks h
    WHERE h.id = homework_files.homework_id
    AND is_teacher_of_class(auth.uid(), h.class_id)
  )
);

CREATE POLICY hwf_student_read ON public.homework_files
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.homeworks h
    JOIN public.enrollments e ON e.class_id = h.class_id
    JOIN public.students s ON s.id = e.student_id
    WHERE h.id = homework_files.homework_id
    AND (s.linked_user_id = auth.uid() OR s.family_id IN (
      SELECT id FROM public.families WHERE primary_user_id = auth.uid()
    ))
  )
);

-- Create storage bucket for homework
INSERT INTO storage.buckets (id, name, public)
VALUES ('homework', 'homework', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for homework bucket
CREATE POLICY "Teachers and admins can upload homework files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'homework' AND
  (has_role(auth.uid(), 'admin'::app_role) OR
   auth.uid() IN (SELECT user_id FROM public.teachers))
);

CREATE POLICY "Teachers and admins can update homework files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'homework' AND
  (has_role(auth.uid(), 'admin'::app_role) OR
   auth.uid() IN (SELECT user_id FROM public.teachers))
);

CREATE POLICY "Authenticated users can view homework files"
ON storage.objects FOR SELECT
USING (bucket_id = 'homework' AND auth.uid() IS NOT NULL);

-- Add session price override column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'sessions' 
                 AND column_name = 'rate_override_vnd') THEN
    ALTER TABLE public.sessions ADD COLUMN rate_override_vnd integer;
  END IF;
END $$;