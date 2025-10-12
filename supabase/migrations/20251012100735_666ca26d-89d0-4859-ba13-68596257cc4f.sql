-- Extend bank_info table for invoice rendering
ALTER TABLE public.bank_info 
ADD COLUMN IF NOT EXISTS org_name text DEFAULT 'Happy English Club',
ADD COLUMN IF NOT EXISTS org_address text DEFAULT NULL;

-- Update RLS policies to allow authenticated users to read bank info (for invoices)
DROP POLICY IF EXISTS "Everyone can view bank info" ON public.bank_info;
CREATE POLICY "Authenticated users can view bank info" 
  ON public.bank_info 
  FOR SELECT 
  USING (auth.uid() IS NOT NULL);