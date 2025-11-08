-- Ensure point_transactions table has all required columns
DO $$ 
BEGIN
  -- Add month column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'point_transactions' 
    AND column_name = 'month'
  ) THEN
    ALTER TABLE point_transactions ADD COLUMN month TEXT NOT NULL DEFAULT to_char(CURRENT_DATE, 'YYYY-MM');
  END IF;

  -- Add date column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'point_transactions' 
    AND column_name = 'date'
  ) THEN
    ALTER TABLE point_transactions ADD COLUMN date DATE NOT NULL DEFAULT CURRENT_DATE;
  END IF;

  -- Add type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'point_transactions' 
    AND column_name = 'type'
  ) THEN
    ALTER TABLE point_transactions ADD COLUMN type TEXT NOT NULL DEFAULT 'manual';
  END IF;

  -- Add homework_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'point_transactions' 
    AND column_name = 'homework_id'
  ) THEN
    ALTER TABLE point_transactions ADD COLUMN homework_id UUID;
  END IF;

  -- Add homework_title column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'point_transactions' 
    AND column_name = 'homework_title'
  ) THEN
    ALTER TABLE point_transactions ADD COLUMN homework_title TEXT;
  END IF;

  -- Add session_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'point_transactions' 
    AND column_name = 'session_id'
  ) THEN
    ALTER TABLE point_transactions ADD COLUMN session_id UUID;
  END IF;

  -- Add notes column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'point_transactions' 
    AND column_name = 'notes'
  ) THEN
    ALTER TABLE point_transactions ADD COLUMN notes TEXT;
  END IF;

  -- Add created_by column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'point_transactions' 
    AND column_name = 'created_by'
  ) THEN
    ALTER TABLE point_transactions ADD COLUMN created_by UUID;
  END IF;

  -- Add created_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'point_transactions' 
    AND column_name = 'created_at'
  ) THEN
    ALTER TABLE point_transactions ADD COLUMN created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- Create archived_leaderboards table for historical data
CREATE TABLE IF NOT EXISTS archived_leaderboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  homework_points INTEGER NOT NULL DEFAULT 0,
  participation_points INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  rank INTEGER,
  archived_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  archived_by UUID REFERENCES auth.users(id)
);

-- Add RLS policies for archived_leaderboards
ALTER TABLE archived_leaderboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage archived leaderboards"
  ON archived_leaderboards
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Students can view their archived scores"
  ON archived_leaderboards
  FOR SELECT
  USING (can_view_student(student_id, auth.uid()));

CREATE POLICY "Teachers can view archived scores for their classes"
  ON archived_leaderboards
  FOR SELECT
  USING (is_teacher_of_class(auth.uid(), class_id));

-- Create function to archive and reset monthly leaderboard
CREATE OR REPLACE FUNCTION archive_and_reset_monthly_leaderboard(target_month TEXT)
RETURNS TABLE(archived_count INTEGER, reset_count INTEGER) AS $$
DECLARE
  v_archived_count INTEGER := 0;
  v_reset_count INTEGER := 0;
BEGIN
  -- Archive current month's data
  INSERT INTO archived_leaderboards (
    student_id, class_id, month, homework_points, participation_points, total_points, rank, archived_by
  )
  SELECT 
    student_id, 
    class_id, 
    month, 
    homework_points, 
    participation_points, 
    total_points,
    ROW_NUMBER() OVER (PARTITION BY class_id ORDER BY total_points DESC) as rank,
    auth.uid()
  FROM student_points
  WHERE month = target_month;
  
  GET DIAGNOSTICS v_archived_count = ROW_COUNT;

  -- Reset student_points for the target month
  UPDATE student_points
  SET 
    homework_points = 0,
    participation_points = 0
  WHERE month = target_month;
  
  GET DIAGNOSTICS v_reset_count = ROW_COUNT;

  -- Archive point transactions (optional: keep for audit trail)
  -- We'll keep the transactions but they won't count toward the new month

  RETURN QUERY SELECT v_archived_count, v_reset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION archive_and_reset_monthly_leaderboard TO authenticated;