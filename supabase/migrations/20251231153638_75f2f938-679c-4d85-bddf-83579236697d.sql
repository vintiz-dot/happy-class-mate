-- Drop the existing type check constraint
ALTER TABLE public.point_transactions 
DROP CONSTRAINT IF EXISTS point_transactions_type_check;

-- Add updated constraint that includes 'correction'
ALTER TABLE public.point_transactions 
ADD CONSTRAINT point_transactions_type_check 
CHECK (type = ANY (ARRAY['homework'::text, 'participation'::text, 'adjustment'::text, 'correction'::text]));