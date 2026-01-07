-- Create trigger function to validate/correct homework point transaction dates
CREATE OR REPLACE FUNCTION public.validate_homework_point_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_homework_due_date DATE;
BEGIN
  -- Only validate homework type transactions with a homework_id
  IF NEW.type = 'homework' AND NEW.homework_id IS NOT NULL THEN
    -- Get the homework's due_date
    SELECT due_date INTO v_homework_due_date
    FROM homeworks
    WHERE id = NEW.homework_id;
    
    -- If homework has a due_date, ensure transaction uses it
    IF v_homework_due_date IS NOT NULL THEN
      -- Auto-correct the date and month to match homework due_date
      NEW.date := v_homework_due_date;
      NEW.month := to_char(v_homework_due_date, 'YYYY-MM');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on point_transactions
DROP TRIGGER IF EXISTS validate_homework_point_date ON point_transactions;
CREATE TRIGGER validate_homework_point_date
  BEFORE INSERT OR UPDATE ON point_transactions
  FOR EACH ROW
  EXECUTE FUNCTION validate_homework_point_transaction();