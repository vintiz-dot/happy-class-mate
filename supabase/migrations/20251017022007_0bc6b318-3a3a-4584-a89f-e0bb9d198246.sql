-- Add canceled tracking columns to sessions
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS canceled_reason text,
ADD COLUMN IF NOT EXISTS canceled_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS canceled_at timestamp with time zone;

-- Function to normalize session statuses (revert invalid Held sessions)
CREATE OR REPLACE FUNCTION public.normalize_session_statuses(p_month text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date;
  v_now_bkk time;
  v_reverted_future integer := 0;
  v_reverted_today integer := 0;
  v_month_start date;
  v_next_month_start date;
BEGIN
  -- Get current date/time in Bangkok timezone
  v_today := (now() AT TIME ZONE 'Asia/Bangkok')::date;
  v_now_bkk := (now() AT TIME ZONE 'Asia/Bangkok')::time;
  
  -- Parse month boundaries
  v_month_start := (p_month || '-01')::date;
  v_next_month_start := (v_month_start + interval '1 month')::date;
  
  -- Revert future sessions marked as Held back to Scheduled
  WITH future_reverted AS (
    UPDATE sessions
    SET status = 'Scheduled'
    WHERE date >= v_month_start
      AND date < v_next_month_start
      AND status = 'Held'
      AND date > v_today
    RETURNING id
  )
  SELECT count(*) INTO v_reverted_future FROM future_reverted;
  
  -- Revert today's sessions marked Held before end_time + 5 minutes
  WITH today_reverted AS (
    UPDATE sessions
    SET status = 'Scheduled'
    WHERE date = v_today
      AND status = 'Held'
      AND (end_time + interval '5 minutes') > v_now_bkk
    RETURNING id
  )
  SELECT count(*) INTO v_reverted_today FROM today_reverted;
  
  RETURN jsonb_build_object(
    'revertedFuture', v_reverted_future,
    'revertedToday', v_reverted_today,
    'totalReverted', v_reverted_future + v_reverted_today
  );
END;
$$;