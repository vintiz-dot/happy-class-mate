
-- Class monitors table: one monitor per class
CREATE TABLE public.class_monitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_monitors_class_id_key UNIQUE (class_id)
);

-- Enable RLS
ALTER TABLE public.class_monitors ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view monitors (needed for leaderboard display)
CREATE POLICY "Authenticated users can view class monitors"
  ON public.class_monitors
  FOR SELECT
  TO authenticated
  USING (true);

-- Teachers of the class and admins can manage monitors
CREATE POLICY "Teachers and admins can manage class monitors"
  ON public.class_monitors
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.is_teacher_of_class(auth.uid(), class_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.is_teacher_of_class(auth.uid(), class_id)
  );
