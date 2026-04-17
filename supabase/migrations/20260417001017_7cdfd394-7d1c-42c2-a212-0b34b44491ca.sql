
-- Create exam_reports table
CREATE TABLE public.exam_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content_html TEXT,
  file_storage_key TEXT,
  file_name TEXT,
  file_size INTEGER,
  exam_date DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_exam_reports_student ON public.exam_reports(student_id);
CREATE INDEX idx_exam_reports_class ON public.exam_reports(class_id);
CREATE INDEX idx_exam_reports_created_by ON public.exam_reports(created_by);

ALTER TABLE public.exam_reports ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins manage all exam reports"
ON public.exam_reports FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Teachers can view reports for students in classes they teach
CREATE POLICY "Teachers view reports for their classes"
ON public.exam_reports FOR SELECT
USING (
  class_id IS NOT NULL AND is_teacher_of_class(auth.uid(), class_id)
);

-- Teachers can insert reports for classes they teach
CREATE POLICY "Teachers insert reports for their classes"
ON public.exam_reports FOR INSERT
WITH CHECK (
  class_id IS NOT NULL 
  AND is_teacher_of_class(auth.uid(), class_id)
  AND created_by = auth.uid()
);

-- Teachers can update only reports they created
CREATE POLICY "Teachers update own reports"
ON public.exam_reports FOR UPDATE
USING (created_by = auth.uid() AND class_id IS NOT NULL AND is_teacher_of_class(auth.uid(), class_id))
WITH CHECK (created_by = auth.uid());

-- Teachers can delete only reports they created
CREATE POLICY "Teachers delete own reports"
ON public.exam_reports FOR DELETE
USING (created_by = auth.uid() AND class_id IS NOT NULL AND is_teacher_of_class(auth.uid(), class_id));

-- Students/family can view their own reports
CREATE POLICY "Students view own exam reports"
ON public.exam_reports FOR SELECT
USING (can_view_student(student_id, auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_exam_reports_updated_at
BEFORE UPDATE ON public.exam_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('exam-reports', 'exam-reports', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: path format = {student_id}/{filename}
-- Admins
CREATE POLICY "Admins manage exam-reports storage"
ON storage.objects FOR ALL
USING (bucket_id = 'exam-reports' AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'exam-reports' AND has_role(auth.uid(), 'admin'::app_role));

-- Students/family can view files for their own reports
CREATE POLICY "Students view own exam-reports files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'exam-reports'
  AND EXISTS (
    SELECT 1 FROM public.exam_reports er
    WHERE er.file_storage_key = storage.objects.name
      AND can_view_student(er.student_id, auth.uid())
  )
);

-- Teachers can view/upload/delete files for reports they authored or for their classes
CREATE POLICY "Teachers view exam-reports files for their classes"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'exam-reports'
  AND EXISTS (
    SELECT 1 FROM public.exam_reports er
    WHERE er.file_storage_key = storage.objects.name
      AND er.class_id IS NOT NULL
      AND is_teacher_of_class(auth.uid(), er.class_id)
  )
);

CREATE POLICY "Teachers upload exam-reports files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'exam-reports'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Teachers delete own exam-reports files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'exam-reports'
  AND EXISTS (
    SELECT 1 FROM public.exam_reports er
    WHERE er.file_storage_key = storage.objects.name
      AND er.created_by = auth.uid()
  )
);
