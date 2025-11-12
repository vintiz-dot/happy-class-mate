-- Remove any constraints limiting points in student_points table
-- Allow unlimited points for homework and participation

-- Drop existing check constraints if they exist
ALTER TABLE IF EXISTS student_points DROP CONSTRAINT IF EXISTS student_points_homework_points_check;
ALTER TABLE IF EXISTS student_points DROP CONSTRAINT IF EXISTS student_points_participation_points_check;
ALTER TABLE IF EXISTS student_points DROP CONSTRAINT IF EXISTS student_points_total_points_check;

-- Drop similar constraints from archived_leaderboards if they exist
ALTER TABLE IF EXISTS archived_leaderboards DROP CONSTRAINT IF EXISTS archived_leaderboards_homework_points_check;
ALTER TABLE IF EXISTS archived_leaderboards DROP CONSTRAINT IF EXISTS archived_leaderboards_participation_points_check;
ALTER TABLE IF EXISTS archived_leaderboards DROP CONSTRAINT IF EXISTS archived_leaderboards_total_points_check;

-- Ensure point columns allow large values (already integer type which is sufficient)
-- No need to modify column types as integer supports up to 2,147,483,647