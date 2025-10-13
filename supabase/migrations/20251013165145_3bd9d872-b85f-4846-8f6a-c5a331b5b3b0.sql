-- Add unique constraint on invoices table to allow upserts by student_id and month
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_pkey;
ALTER TABLE public.invoices ADD PRIMARY KEY (id);

-- Create unique constraint for student_id and month
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_student_id_month_key;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_student_id_month_key UNIQUE (student_id, month);