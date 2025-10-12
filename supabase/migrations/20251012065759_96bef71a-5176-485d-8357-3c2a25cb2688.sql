-- Idempotent migration for automatic attendance seeding
-- Creates triggers to automatically create attendance rows when sessions or enrollments are created

-- Helper function: seed attendance rows for a class-date range
CREATE OR REPLACE FUNCTION public._attendance_seed_for_class_dates(p_class uuid, p_from date, p_to date)
RETURNS void 
LANGUAGE sql 
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.attendance(session_id, student_id, status, marked_by)
  SELECT s.id, e.student_id, 'Present', NULL
  FROM public.sessions s
  JOIN public.enrollments e ON e.class_id = s.class_id
  WHERE s.class_id = p_class
    AND s.date BETWEEN p_from AND p_to
    AND e.start_date <= s.date
    AND (e.end_date IS NULL OR s.date <= e.end_date)
  ON CONFLICT (session_id, student_id) DO NOTHING;
$$;

-- Trigger function: after session insert, seed attendance for all active enrollments
CREATE OR REPLACE FUNCTION public._attendance_after_session_ins()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._attendance_seed_for_class_dates(NEW.class_id, NEW.date, NEW.date);
  RETURN NEW;
END;
$$;

-- Create trigger for session inserts (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_attendance_after_session_ins'
  ) THEN
    CREATE TRIGGER trg_attendance_after_session_ins
    AFTER INSERT ON public.sessions
    FOR EACH ROW EXECUTE FUNCTION public._attendance_after_session_ins();
  END IF;
END$$;

-- Trigger function: after enrollment insert, backfill attendance for existing sessions
CREATE OR REPLACE FUNCTION public._attendance_after_enrollment_ins()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE 
  dfrom date;
BEGIN
  -- Backfill from enrollment start or 6 months ago, whichever is later
  dfrom := GREATEST(NEW.start_date, CURRENT_DATE - INTERVAL '6 months');
  PERFORM public._attendance_seed_for_class_dates(
    NEW.class_id, 
    dfrom, 
    (CURRENT_DATE + INTERVAL '6 months')::date
  );
  RETURN NEW;
END;
$$;

-- Create trigger for enrollment inserts (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_attendance_after_enrollment_ins'
  ) THEN
    CREATE TRIGGER trg_attendance_after_enrollment_ins
    AFTER INSERT ON public.enrollments
    FOR EACH ROW EXECUTE FUNCTION public._attendance_after_enrollment_ins();
  END IF;
END$$;