-- Recalculate all student_points from point_transactions
-- This fixes any data corrupted by the direct upsert bug in HomeworkGradingList

-- Clear existing student_points
TRUNCATE TABLE student_points;

-- Rebuild student_points from point_transactions using the correct aggregation
-- Note: total_points is a generated column, so we don't insert it directly
INSERT INTO student_points (student_id, class_id, month, homework_points, participation_points)
SELECT 
  student_id,
  class_id,
  month,
  COALESCE(SUM(CASE WHEN type = 'homework' THEN points ELSE 0 END), 0) as homework_points,
  COALESCE(SUM(CASE WHEN type IN ('participation', 'adjustment') THEN points ELSE 0 END), 0) as participation_points
FROM point_transactions
WHERE student_id IS NOT NULL 
  AND class_id IS NOT NULL 
  AND month IS NOT NULL
GROUP BY student_id, class_id, month;

-- Verify the fix by checking point totals match transactions
DO $$
DECLARE
  mismatch_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO mismatch_count
  FROM student_points sp
  LEFT JOIN (
    SELECT 
      student_id, 
      class_id, 
      month, 
      SUM(points) as total
    FROM point_transactions
    GROUP BY student_id, class_id, month
  ) pt ON sp.student_id = pt.student_id 
      AND sp.class_id = pt.class_id 
      AND sp.month = pt.month
  WHERE sp.total_points != COALESCE(pt.total, 0);
  
  IF mismatch_count > 0 THEN
    RAISE NOTICE 'Warning: % records still have mismatches', mismatch_count;
  ELSE
    RAISE NOTICE 'Success: All student_points records now match point_transactions';
  END IF;
END $$;