-- Remove the overly permissive policy that allows any authenticated user to view bank info
DROP POLICY IF EXISTS "Authenticated users can view bank info" ON public.bank_info;

-- The remaining policies are correct:
-- 1. "Admins and families can view bank info" - allows SELECT for admins, families, and linked students
-- 2. "Admins can manage bank info" - allows ALL operations for admins only