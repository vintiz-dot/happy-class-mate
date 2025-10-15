-- Add recorded_payment column to invoices table to track cumulative payments
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS recorded_payment integer DEFAULT 0;

COMMENT ON COLUMN public.invoices.recorded_payment IS 'Cumulative payment amount recorded for this student up to this month';