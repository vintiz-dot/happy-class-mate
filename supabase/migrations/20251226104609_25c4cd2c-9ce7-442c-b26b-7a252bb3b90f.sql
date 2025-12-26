-- Fix the function search path security issue
CREATE OR REPLACE FUNCTION recalculate_student_points_on_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_month TEXT;
  v_homework_points INTEGER;
  v_participation_points INTEGER;
BEGIN
  v_month := to_char(OLD.date, 'YYYY-MM');
  
  SELECT 
    COALESCE(SUM(CASE WHEN type = 'homework' THEN points ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type IN ('participation', 'adjustment') THEN points ELSE 0 END), 0)
  INTO v_homework_points, v_participation_points
  FROM public.point_transactions
  WHERE student_id = OLD.student_id
    AND class_id = OLD.class_id
    AND to_char(date, 'YYYY-MM') = v_month;
  
  UPDATE public.student_points 
  SET 
    homework_points = v_homework_points,
    participation_points = v_participation_points,
    updated_at = now()
  WHERE student_id = OLD.student_id 
    AND class_id = OLD.class_id 
    AND month = v_month;
    
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;