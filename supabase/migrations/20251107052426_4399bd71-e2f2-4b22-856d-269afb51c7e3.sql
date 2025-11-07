-- Create point transactions table to track individual point awards/deductions
CREATE TABLE IF NOT EXISTS public.point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  points INTEGER NOT NULL, -- Can be positive or negative
  type TEXT NOT NULL CHECK (type IN ('homework', 'participation', 'adjustment')),
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  homework_id UUID REFERENCES public.homeworks(id) ON DELETE SET NULL,
  homework_title TEXT,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  notes TEXT
);

-- Create index for faster queries
CREATE INDEX idx_point_transactions_student ON public.point_transactions(student_id);
CREATE INDEX idx_point_transactions_class_month ON public.point_transactions(class_id, date);

-- Enable RLS
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for point_transactions
CREATE POLICY "Admins can manage all point transactions"
ON public.point_transactions FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teachers can manage transactions for their classes"
ON public.point_transactions FOR ALL
TO authenticated
USING (is_teacher_of_class(auth.uid(), class_id))
WITH CHECK (is_teacher_of_class(auth.uid(), class_id));

CREATE POLICY "Students can view their own transactions"
ON public.point_transactions FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT id FROM students 
    WHERE linked_user_id = auth.uid()
    OR family_id IN (
      SELECT id FROM families WHERE primary_user_id = auth.uid()
    )
  )
);

CREATE POLICY "Students can view class transactions"
ON public.point_transactions FOR SELECT
TO authenticated
USING (
  class_id IN (
    SELECT DISTINCT e.class_id
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    WHERE s.linked_user_id = auth.uid()
    OR s.family_id IN (
      SELECT family_id FROM students WHERE linked_user_id = auth.uid()
    )
  )
);

-- Function to update student_points when transactions are added
CREATE OR REPLACE FUNCTION update_student_points_from_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_month TEXT;
  v_homework_points INTEGER;
  v_participation_points INTEGER;
BEGIN
  -- Get the month from the transaction date
  v_month := to_char(NEW.date, 'YYYY-MM');
  
  -- Calculate total homework and participation points for this student/class/month
  SELECT 
    COALESCE(SUM(CASE WHEN type = 'homework' THEN points ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type IN ('participation', 'adjustment') THEN points ELSE 0 END), 0)
  INTO v_homework_points, v_participation_points
  FROM point_transactions
  WHERE student_id = NEW.student_id
    AND class_id = NEW.class_id
    AND to_char(date, 'YYYY-MM') = v_month;
  
  -- Insert or update student_points
  INSERT INTO student_points (student_id, class_id, month, homework_points, participation_points)
  VALUES (NEW.student_id, NEW.class_id, v_month, v_homework_points, v_participation_points)
  ON CONFLICT (student_id, class_id, month)
  DO UPDATE SET
    homework_points = v_homework_points,
    participation_points = v_participation_points,
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_points_from_transaction
AFTER INSERT OR UPDATE ON public.point_transactions
FOR EACH ROW
EXECUTE FUNCTION update_student_points_from_transaction();

-- Enable realtime for point_transactions
ALTER TABLE public.point_transactions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.point_transactions;