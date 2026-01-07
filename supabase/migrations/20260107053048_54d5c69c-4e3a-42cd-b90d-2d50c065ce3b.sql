-- Fix the Jupiter class homework transactions that were graded with old cached code
UPDATE point_transactions pt
SET 
  date = h.due_date,
  month = to_char(h.due_date::date, 'YYYY-MM')
FROM homeworks h
WHERE pt.homework_id = h.id
  AND pt.type = 'homework'
  AND pt.class_id = '18dab237-8295-4bae-96d0-e3dfcfc90a41'
  AND pt.month = '2026-01'
  AND h.due_date IS NOT NULL
  AND pt.date != h.due_date
  AND pt.created_at >= '2026-01-06 19:16:00';

-- Rebuild student_points with corrected data (excluding generated column total_points)
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