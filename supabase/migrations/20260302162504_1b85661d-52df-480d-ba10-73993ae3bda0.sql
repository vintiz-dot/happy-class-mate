ALTER TABLE public.students ADD COLUMN status_message text DEFAULT NULL;

CREATE OR REPLACE FUNCTION public.validate_status_message()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status_message IS NOT NULL AND length(NEW.status_message) > 50 THEN
    RAISE EXCEPTION 'status_message must be 50 characters or fewer';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_status_message
  BEFORE INSERT OR UPDATE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_status_message();