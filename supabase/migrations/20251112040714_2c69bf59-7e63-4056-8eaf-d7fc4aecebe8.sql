-- Remove point cap constraint from point_transactions to allow unlimited points
ALTER TABLE point_transactions DROP CONSTRAINT IF EXISTS points_range_check;

-- Ensure point_transactions has proper structure for tracking
COMMENT ON TABLE point_transactions IS 'Tracks individual point awards/deductions. Trigger automatically updates student_points aggregate table.';