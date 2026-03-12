
ALTER TABLE public.site_announcements
  ADD COLUMN target_class_ids uuid[] DEFAULT '{}',
  ADD COLUMN target_student_ids uuid[] DEFAULT '{}';
