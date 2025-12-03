-- Add class_breakdown column to store per-class tuition amounts
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS class_breakdown jsonb DEFAULT '[]'::jsonb;