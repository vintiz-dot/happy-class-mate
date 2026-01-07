-- Add reading_theory_points column to student_points
ALTER TABLE student_points 
ADD COLUMN IF NOT EXISTS reading_theory_points INTEGER NOT NULL DEFAULT 0;

-- Drop and recreate the generated total_points column to include reading_theory_points
ALTER TABLE student_points DROP COLUMN IF EXISTS total_points;
ALTER TABLE student_points 
ADD COLUMN total_points INTEGER GENERATED ALWAYS AS 
  (homework_points + participation_points + reading_theory_points) STORED;

-- Update point_transactions type constraint to include reading_theory
ALTER TABLE point_transactions 
DROP CONSTRAINT IF EXISTS point_transactions_type_check;

ALTER TABLE point_transactions 
ADD CONSTRAINT point_transactions_type_check 
CHECK (type IN ('homework', 'participation', 'adjustment', 'correction', 'reading_theory'));

-- Update the trigger function to handle reading_theory_points
CREATE OR REPLACE FUNCTION update_student_points_from_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_month TEXT;
  v_homework_points INTEGER;
  v_participation_points INTEGER;
  v_reading_theory_points INTEGER;
BEGIN
  v_month := to_char(NEW.date, 'YYYY-MM');
  
  SELECT 
    COALESCE(SUM(CASE WHEN type = 'homework' THEN points ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type IN ('participation', 'adjustment', 'correction') THEN points ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'reading_theory' THEN points ELSE 0 END), 0)
  INTO v_homework_points, v_participation_points, v_reading_theory_points
  FROM point_transactions
  WHERE student_id = NEW.student_id
    AND class_id = NEW.class_id
    AND to_char(date, 'YYYY-MM') = v_month;
  
  INSERT INTO student_points (student_id, class_id, month, homework_points, participation_points, reading_theory_points)
  VALUES (NEW.student_id, NEW.class_id, v_month, v_homework_points, v_participation_points, v_reading_theory_points)
  ON CONFLICT (student_id, class_id, month)
  DO UPDATE SET
    homework_points = v_homework_points,
    participation_points = v_participation_points,
    reading_theory_points = v_reading_theory_points,
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;