-- Add unique constraint to invoices for upserts (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'invoices_student_id_month_key'
  ) THEN
    ALTER TABLE public.invoices 
      ADD CONSTRAINT invoices_student_id_month_key 
      UNIQUE (student_id, month);
  END IF;
END $$;