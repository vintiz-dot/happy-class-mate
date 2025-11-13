-- Fix archive_and_reset_monthly_leaderboard function to add search_path
-- This completes the fix for function_search_path_mutable security warning

CREATE OR REPLACE FUNCTION public.archive_and_reset_monthly_leaderboard(target_month text)
RETURNS TABLE(archived_count integer, reset_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;