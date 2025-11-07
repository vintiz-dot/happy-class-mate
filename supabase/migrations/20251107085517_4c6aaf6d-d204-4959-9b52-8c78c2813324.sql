-- Add constraint to point_transactions to enforce -100 to 100 range
ALTER TABLE point_transactions
ADD CONSTRAINT points_range_check CHECK (points >= -100 AND points <= 100);

-- Reset all student points to 0 (total_points is a generated column)
UPDATE student_points
SET 
  homework_points = 0,
  participation_points = 0;

-- Clear all existing point transactions for fresh start
TRUNCATE TABLE point_transactions;