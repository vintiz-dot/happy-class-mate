-- Migration: Add database trigger to prevent future sessions from being marked as "Held"
-- Also includes cleanup of existing invalid sessions

-- 1. Create trigger function to validate session status changes
CREATE OR REPLACE FUNCTION public.validate_session_status_on_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now_bkk timestamp with time zone;
  v_session_start timestamp with time zone;
  v_five_minutes_after timestamp with time zone;
BEGIN
  -- Only validate if status is being set to 'Held'
  IF NEW.status = 'Held' THEN
    -- Get current time in Bangkok timezone
    v_now_bkk := now() AT TIME ZONE 'Asia/Bangkok';
    
    -- Construct session start time in Bangkok timezone
    v_session_start := (NEW.date::text || ' ' || NEW.start_time::text)::timestamp AT TIME ZONE 'Asia/Bangkok';
    v_five_minutes_after := v_session_start + interval '5 minutes';
    
    -- If session hasn't reached start_time + 5 minutes yet, revert to Scheduled
    IF v_now_bkk < v_five_minutes_after THEN
      NEW.status := 'Scheduled';
      RAISE NOTICE 'Auto-corrected session % status from Held to Scheduled (session not yet started)', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Attach trigger to sessions table
DROP TRIGGER IF EXISTS validate_session_status_trigger ON public.sessions;

CREATE TRIGGER validate_session_status_trigger
  BEFORE INSERT OR UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_session_status_on_change();

-- 3. Cleanup existing invalid sessions (one-time fix)
-- Revert future sessions marked as "Held" to "Scheduled"
-- Also revert today's sessions marked "Held" before their start time + 5 minutes
UPDATE public.sessions
SET 
  status = 'Scheduled',
  updated_at = now()
WHERE status = 'Held'
  AND (
    -- Future sessions
    date > CURRENT_DATE
    OR 
    -- Today's sessions where it's not yet 5 minutes past start time
    (
      date = CURRENT_DATE 
      AND (
        SELECT now() AT TIME ZONE 'Asia/Bangkok' 
        < (date::text || ' ' || start_time::text)::timestamp AT TIME ZONE 'Asia/Bangkok' + interval '5 minutes'
      )
    )
  );

-- Log the cleanup results
DO $$
DECLARE
  v_updated_count integer;
BEGIN
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Cleanup complete: % invalid "Held" sessions reverted to "Scheduled"', v_updated_count;
END $$;