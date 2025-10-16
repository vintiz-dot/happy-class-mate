-- Create function to revert invalid held sessions
CREATE OR REPLACE FUNCTION public.revert_invalid_held_sessions(
  p_month text,
  p_today date,
  p_now time
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reverted_future integer := 0;
  v_reverted_today integer := 0;
  v_reverted_ids uuid[] := '{}';
  v_month_start date;
  v_next_month_start date;
BEGIN
  -- Parse month boundaries
  v_month_start := (p_month || '-01')::date;
  v_next_month_start := (v_month_start + interval '1 month')::date;
  
  -- Revert future sessions marked as Held
  WITH future_reverted AS (
    UPDATE sessions
    SET status = 'Scheduled'
    WHERE date >= v_month_start
      AND date < v_next_month_start
      AND status = 'Held'
      AND date > p_today
    RETURNING id
  )
  SELECT count(*), array_agg(id)
  INTO v_reverted_future, v_reverted_ids
  FROM future_reverted;
  
  -- Revert today's sessions marked Held before start_time + 5 minutes
  WITH today_reverted AS (
    UPDATE sessions
    SET status = 'Scheduled'
    WHERE date = p_today
      AND status = 'Held'
      AND (start_time + interval '5 minutes') > p_now
    RETURNING id
  )
  SELECT count(*), array_agg(id)
  INTO v_reverted_today, v_reverted_ids
  FROM today_reverted;
  
  RETURN jsonb_build_object(
    'revertedFuture', v_reverted_future,
    'revertedToday', v_reverted_today,
    'totalReverted', v_reverted_future + v_reverted_today,
    'revertedIds', v_reverted_ids
  );
END;
$$;

-- Improve job_lock with better upsert capability
CREATE OR REPLACE FUNCTION public.assert_job_lock(p_job text, p_month text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if there's an unfinished lock
  IF EXISTS (
    SELECT 1 FROM job_lock
    WHERE job = p_job
      AND month = p_month
      AND finished_at IS NULL
  ) THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;