-- Step 1: Update point_transactions to use homework due_date instead of grading date
UPDATE point_transactions pt
SET 
  date = h.due_date,
  month = to_char(h.due_date, 'YYYY-MM')
FROM homeworks h
WHERE pt.homework_id = h.id
  AND pt.type = 'homework'
  AND h.due_date IS NOT NULL
  AND pt.date != h.due_date;

-- Step 2: Recalculate all student_points from corrected point_transactions
TRUNCATE TABLE student_points;

INSERT INTO student_points (student_id, class_id, month, homework_points, participation_points)
SELECT 
  student_id,
  class_id,
  month,
  COALESCE(SUM(CASE WHEN type = 'homework' THEN points ELSE 0 END), 0) as homework_points,
  COALESCE(SUM(CASE WHEN type IN ('participation', 'adjustment', 'correction') THEN points ELSE 0 END), 0) as participation_points
FROM point_transactions
GROUP BY student_id, class_id, month
ON CONFLICT (student_id, class_id, month)
DO UPDATE SET
  homework_points = EXCLUDED.homework_points,
  participation_points = EXCLUDED.participation_points,
  updated_at = now();