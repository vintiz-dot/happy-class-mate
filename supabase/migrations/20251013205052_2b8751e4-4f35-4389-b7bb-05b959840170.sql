-- Fix security warnings by updating functions with proper search_path
-- Use CREATE OR REPLACE instead of DROP to avoid cascade issues

-- 1. Fix function search paths for functions that don't have it set
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

-- 2. Fix the _attendance_after_session_ins trigger function
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

-- 3. Fix the _attendance_after_enrollment_ins trigger function
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

-- 4. Fix update_student_points_timestamp function
CREATE OR REPLACE FUNCTION public.update_student_points_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;