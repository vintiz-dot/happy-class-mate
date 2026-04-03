
-- Auto-end all active enrollments when a student is deactivated
CREATE OR REPLACE FUNCTION public.auto_end_enrollments_on_deactivation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only fire when is_active changes from true to false
  IF OLD.is_active = true AND NEW.is_active = false THEN
    UPDATE enrollments
    SET 
      end_date = CURRENT_DATE,
      updated_at = now()
    WHERE student_id = NEW.id
      AND end_date IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_student_deactivation_end_enrollments
BEFORE UPDATE ON public.students
FOR EACH ROW
WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active)
EXECUTE FUNCTION public.auto_end_enrollments_on_deactivation();
